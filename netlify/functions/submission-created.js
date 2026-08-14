// Netlify's "legacy filename convention" for form-triggered functions:
// a function named exactly `submission-created` runs automatically on every
// verified form submission across the whole site — no webhook URL to configure.
// Docs: https://docs.netlify.com/build/functions/trigger-on-events/

// Maps each form (by its `name` attribute) + submitted fields to the
// ActiveCampaign tags your original brand refresh plan called for.
function getTagsForSubmission(formName, data) {
  const tags = [];

  if (formName === "contact") {
    tags.push("Contact Inquiry");
    const serviceTagMap = {
      Snapshot: "Snapshot Lead",
      "GEO Retainer": "GEO Lead",
      "Lead-to-Revenue Tracking": "Attribution Lead",
      "Not sure": "Service: Not Sure",
    };
    if (data.service && serviceTagMap[data.service]) {
      tags.push(serviceTagMap[data.service]);
    }
  } else if (formName === "snapshot-request") {
    tags.push("Snapshot Requested");
    // Both /snapshot/ and the paid-ads landing page /ai-visibility-snapshot/ post
    // to this same form, so a hidden `source` field distinguishes them. Older
    // submissions predate that field — when it's absent we add no source tag at
    // all rather than guessing, so historical leads stay untouched.
    const sourceTagMap = {
      "paid-ads": "Source: Paid Ads",
      organic: "Source: Organic",
    };
    if (data.source && sourceTagMap[data.source]) {
      tags.push(sourceTagMap[data.source]);
    }
  } else if (formName === "geo-checklist") {
    tags.push("Checklist Downloaded");
  }

  return tags;
}

async function findOrCreateTag(baseUrl, headers, tagName) {
  // ActiveCampaign's tag list endpoint filters with `search`, not `filters[name]`.
  // `search` can match partially, so we still confirm an exact name match below
  // rather than trusting the first result.
  const searchRes = await fetch(
    `${baseUrl}/api/3/tags?search=${encodeURIComponent(tagName)}`,
    { headers }
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.error(`AC tag search failed (${searchRes.status}) for "${tagName}":`, errText);
  } else {
    const searchJson = await searchRes.json();
    const existing = (searchJson.tags || []).find((t) => t.tag === tagName);
    if (existing) {
      console.log(`Found existing tag "${tagName}" with id ${existing.id}`);
      return existing.id;
    }
  }

  const createRes = await fetch(`${baseUrl}/api/3/tags`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tag: { tag: tagName, tagType: "contact" } }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.tag) {
    console.error(`AC tag create failed (${createRes.status}) for "${tagName}":`, JSON.stringify(createJson));
    return null;
  }
  console.log(`Created new tag "${tagName}" with id ${createJson.tag.id}`);
  return createJson.tag.id;
}

// ---------------------------------------------------------------------------
// Deal creation
// ---------------------------------------------------------------------------
// Which pipeline and stage new deals land in. Both can be overridden with
// Netlify env vars without touching this file. Pipeline 1 = the pipeline at
// .../app/deals?pipeline=1; "Prospect" is its first stage.
const AC_PIPELINE_ID = process.env.AC_PIPELINE_ID || "1";
const AC_STAGE_TITLE = process.env.AC_STAGE_TITLE || "Prospect";

// A human-readable deal title per form, so the pipeline card is scannable
// without opening it.
function getDealTitle(formName, data) {
  const who = data.company_url || data.name || data.email;
  if (formName === "snapshot-request") return `Snapshot Request — ${who}`;
  if (formName === "contact") return `Contact Inquiry — ${who}`;
  if (formName === "geo-checklist") return `Checklist Download — ${who}`;
  return `Website Lead — ${who}`;
}

// Everything the form captured, dropped into the deal's description so it is
// visible on the card rather than only on the contact record.
function getDealDescription(formName, data) {
  const lines = [`Form: ${formName}`];
  if (data.company_url) lines.push(`Website: ${data.company_url}`);
  if (data.service) lines.push(`Service interest: ${data.service}`);
  if (data.source) lines.push(`Source: ${data.source}`);
  if (data.prompt) lines.push(`\nWhat they said:\n${data.prompt}`);
  return lines.join("\n");
}

// The deals endpoint requires a numeric stage id and an owner id, neither of
// which we want hardcoded. Look both up once per cold start.
async function resolveStageId(baseUrl, headers) {
  const res = await fetch(
    `${baseUrl}/api/3/dealStages?filters[d_groupid]=${encodeURIComponent(AC_PIPELINE_ID)}`,
    { headers }
  );
  if (!res.ok) {
    console.error(`AC dealStages lookup failed (${res.status}):`, await res.text());
    return null;
  }
  const json = await res.json();
  const stages = json.dealStages || [];
  const wanted = stages.find(
    (s) => (s.title || "").toLowerCase() === AC_STAGE_TITLE.toLowerCase()
  );
  if (!wanted) {
    console.error(
      `No stage titled "${AC_STAGE_TITLE}" in pipeline ${AC_PIPELINE_ID}. Available: ${stages
        .map((s) => s.title)
        .join(", ")}`
    );
    return null;
  }
  return wanted.id;
}

async function resolveOwnerId(baseUrl, headers) {
  const res = await fetch(`${baseUrl}/api/3/users/me`, { headers });
  if (!res.ok) {
    console.error(`AC users/me lookup failed (${res.status}):`, await res.text());
    return null;
  }
  const json = await res.json();
  return json.user && json.user.id;
}

async function createDeal(baseUrl, headers, contactId, formName, data) {
  const [stageId, ownerId] = await Promise.all([
    resolveStageId(baseUrl, headers),
    resolveOwnerId(baseUrl, headers),
  ]);
  if (!stageId || !ownerId) {
    console.error("Could not resolve stage or owner — skipping deal creation.");
    return null;
  }

  const res = await fetch(`${baseUrl}/api/3/deals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      deal: {
        contact: contactId,
        description: getDealDescription(formName, data),
        currency: "usd",
        group: String(AC_PIPELINE_ID),
        stage: String(stageId),
        owner: String(ownerId),
        title: getDealTitle(formName, data),
        value: 0, // cents; set later by hand once the opportunity is sized
      },
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.deal) {
    console.error(`AC deal create failed (${res.status}):`, JSON.stringify(json));
    return null;
  }
  console.log(`Created deal ${json.deal.id} ("${json.deal.title}") for contact ${contactId}.`);
  return json.deal.id;
}

exports.handler = async (event) => {
  const AC_API_URL = process.env.AC_API_URL; // e.g. https://brianhafnertech.api-us1.com (no trailing slash)
  const AC_API_KEY = process.env.AC_API_KEY; // ActiveCampaign > Settings > Developer

  if (!AC_API_URL || !AC_API_KEY) {
    console.error("Missing AC_API_URL or AC_API_KEY environment variables — skipping AC sync.");
    return { statusCode: 200, body: "AC not configured, skipping." };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    console.error("Could not parse submission payload:", event.body);
    return { statusCode: 400, body: "Invalid payload" };
  }

  // Netlify's payload shape has historically been { payload: { data, form_name, ... } }.
  // Fall back gracefully in case that shape ever changes.
  const payload = body.payload || body;
  const data = payload.data || {};
  const formName = payload.form_name || data["form-name"];

  const email = data.email;
  if (!email) {
    console.log(`Submission for form "${formName}" had no email field, skipping AC sync.`);
    return { statusCode: 200, body: "No email, skipping." };
  }

  const headers = {
    "Api-Token": AC_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    // 1. Create or update the contact by email.
    const contactRes = await fetch(`${AC_API_URL}/api/3/contact/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contact: {
          email,
          firstName: data.name || "",
          fieldValues: [],
        },
      }),
    });
    const contactJson = await contactRes.json();
    const contactId = contactJson.contact && contactJson.contact.id;

    if (!contactId) {
      console.error("ActiveCampaign contact sync failed:", JSON.stringify(contactJson));
      return { statusCode: 502, body: "AC contact sync failed" };
    }

    // 2. Apply the relevant tag(s) for this form.
    console.log(`ActiveCampaign contact id for ${email}: ${contactId}`);
    const tagNames = getTagsForSubmission(formName, data);
    for (const tagName of tagNames) {
      const tagId = await findOrCreateTag(AC_API_URL, headers, tagName);
      if (!tagId) {
        console.error(`Could not find or create tag "${tagName}", skipping attach.`);
        continue;
      }
      const attachRes = await fetch(`${AC_API_URL}/api/3/contactTags`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
      });
      const attachJson = await attachRes.json();
      if (!attachRes.ok) {
        console.error(`AC contactTags attach failed (${attachRes.status}) for tag "${tagName}" (id ${tagId}) on contact ${contactId}:`, JSON.stringify(attachJson));
      } else {
        console.log(`Attached tag "${tagName}" (id ${tagId}) to contact ${contactId}.`);
      }
    }

    // 3. Create a deal in the pipeline. Deliberately last and non-fatal: if this
    //    fails the contact and tags are already saved, so the lead is never lost.
    const dealId = await createDeal(AC_API_URL, headers, contactId, formName, data);

    console.log(
      `Synced "${formName}" submission for ${email} to ActiveCampaign with tags: ${
        tagNames.join(", ") || "(none)"
      }; deal: ${dealId || "NOT CREATED"}`
    );
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Error syncing to ActiveCampaign:", err);
    return { statusCode: 500, body: "Error: " + err.message };
  }
};

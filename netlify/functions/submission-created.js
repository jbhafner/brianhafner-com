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
  } else if (formName === "geo-checklist") {
    tags.push("Checklist Downloaded");
  }

  return tags;
}

async function findOrCreateTag(baseUrl, headers, tagName) {
  const searchRes = await fetch(
    `${baseUrl}/api/3/tags?filters[name]=${encodeURIComponent(tagName)}`,
    { headers }
  );
  const searchJson = await searchRes.json();
  const existing = searchJson.tags && searchJson.tags[0];
  if (existing) return existing.id;

  const createRes = await fetch(`${baseUrl}/api/3/tags`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tag: { tag: tagName, tagType: "contact" } }),
  });
  const createJson = await createRes.json();
  return createJson.tag && createJson.tag.id;
}

exports.handler = async (event) => {
  const AC_API_URL = process.env.AC_API_URL; // e.g. https://youraccountname.api-us1.com (no trailing slash)
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
    const tagNames = getTagsForSubmission(formName, data);
    for (const tagName of tagNames) {
      const tagId = await findOrCreateTag(AC_API_URL, headers, tagName);
      if (tagId) {
        await fetch(`${AC_API_URL}/api/3/contactTags`, {
          method: "POST",
          headers,
          body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
        });
      } else {
        console.error(`Could not find or create tag "${tagName}"`);
      }
    }

    console.log(`Synced "${formName}" submission for ${email} to ActiveCampaign with tags: ${tagNames.join(", ") || "(none)"}`);
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Error syncing to ActiveCampaign:", err);
    return { statusCode: 500, body: "Error: " + err.message };
  }
};

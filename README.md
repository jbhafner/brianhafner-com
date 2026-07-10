# brianhafner.com — Eleventy + Decap CMS

This site is now built with [Eleventy](https://www.11ty.dev/) (a static site generator) instead of plain HTML files, so that blog posts live on this same site and can be added without hand-writing HTML. [Decap CMS](https://decapcms.org/) is wired up as a `/admin` editor for posting without using git or Terminal.

## What changed from the plain-HTML version

- All page source now lives under `src/` (templates in Nunjucks `.njk` format) instead of raw `.html` files at the repo root.
- One shared layout (`src/_includes/base.njk`) holds the header, nav, and footer — editing it once updates every page, instead of editing every file by hand.
- `src/blog/` holds the blog: `index.njk` is the paginated listing, `posts/*.md` are individual posts (Markdown, not HTML).
- Netlify now runs a real build step (`npm run build`, via `netlify.toml`) that turns `src/` into the `_site/` folder Netlify publishes. Previously there was no build step at all.
- `/admin/` is the Decap CMS editor (see setup below).

## One-time setup after this deploys (you need to do this in the Netlify dashboard)

Decap CMS needs a way to authenticate you before letting you publish. This is a one-time setup:

1. In Netlify: **Site settings → Identity → Enable Identity**.
2. Still in Identity settings, under **Registration**, set it to **Invite only** (so random people can't sign up).
3. Under **Services → Git Gateway**, click **Enable Git Gateway**. This lets Decap commit changes to GitHub on your behalf when you click Publish.
4. Go to the **Identity** tab (top nav of your site in Netlify) → **Invite users** → invite yourself with your email.
5. Check your email, accept the invite, and set a password.
6. Visit `https://<your-site>.netlify.app/admin/` (or `brianhafner.com/admin/` once the domain is live), log in, and you'll see the Blog Posts collection.

After that, writing a post is: log into `/admin/`, click **New Blog Post**, fill in title/date/description/body, click **Publish** — Decap commits the file to GitHub and Netlify rebuilds automatically. No Terminal needed.

## ActiveCampaign integration

The Contact, Snapshot request, and GEO checklist forms still submit through Netlify Forms exactly as before (so submissions stay visible in Netlify's Forms dashboard) — but a serverless function (`netlify/functions/submission-created.js`) now runs automatically on every submission and pushes the contact into ActiveCampaign with the tag your original plan called for:

- Contact form → tag `Contact Inquiry`, plus a service-specific tag (`Snapshot Lead`, `GEO Lead`, `Attribution Lead`, or `Service: Not Sure`) based on which radio button was selected.
- Snapshot request form → tag `Snapshot Requested`.
- GEO checklist form → tag `Checklist Downloaded`.

You can build AC automations off those tags exactly as described in your original brand refresh plan (confirmation emails, internal reminders, the 5-email GEO nurture sequence, etc.) — the function only handles getting the contact and tag into AC; the automations themselves are configured in ActiveCampaign, not here.

**One-time setup required (you need to do this):**

1. In ActiveCampaign: **Settings → Developer**. Copy your **API URL** (looks like `https://youraccountname.api-us1.com`, no trailing slash) and **API Key**.
2. In Netlify: **Project configuration → Environment variables → Add a variable**. Add two:
   - `AC_API_URL` — paste your API URL
   - `AC_API_KEY` — paste your API key
3. Trigger a new deploy (any git push does this, or use "Trigger deploy" in Netlify) so the function picks up the new environment variables.
4. Submit a real test entry on each of the 3 forms, then check **ActiveCampaign → Contacts** for a test contact with the right tag applied. Also check **Netlify → Logs → Functions → submission-created** if something doesn't show up — it logs what it received and any errors.

If you'd ever rather use ActiveCampaign's own embeddable forms instead of this function, that's also possible — just ask, since it's a straightforward swap.

## Local development (optional)

If you ever want to preview changes on your own machine before pushing:

```
npm install
npm run serve
```

This runs Eleventy's local dev server with live reload.

## Blog migration notes

9 posts were migrated from the old WordPress blog (`brianhafner.com/blog`) — the ones that fit the new AI Visibility / GEO positioning (May–June 2026). Their original URLs were preserved exactly (e.g. `/building-your-ai-ready-knowledge-base/`) so there's no SEO redirect needed if this ever replaces the WordPress site.

Older posts (generalist marketing content — retargeting, lead scoring, email sequences, etc.) were intentionally left behind, per the curation call made when this migration started. If you want any of those brought over later, just point me at the ones you want and I'll add them the same way.

To add a post yourself without Decap: create a new file in `src/blog/posts/` named `YYYY-MM-DD-your-slug.md` with front matter like:

```
---
title: "Your Post Title"
date: 2026-07-15
description: "One or two sentences — shows on the blog index and as the SEO meta description."
---
Your post content in Markdown goes here.
```

Commit and push — Netlify handles the rest.

## Deploying

Same as before: push to the `main` branch on GitHub, and Netlify auto-builds and deploys.

```
git add .
git commit -m "your message"
git push
```

## Domain

Not yet pointed at brianhafner.com — see prior notes on DNS cutover. Once you do point the domain here, remember the WordPress blog it replaces will go offline, so the `/blog/` link that used to point to WordPress now correctly resolves on this same site instead.

## File structure

```
package.json            Eleventy + build script
.eleventy.js             Eleventy config (input/output dirs, collections, filters)
netlify.toml             Build command, publish directory, and functions directory for Netlify
netlify/functions/
  submission-created.js  Runs on every form submission, syncs contact + tag to ActiveCampaign
admin/
  index.html             Decap CMS loader
  config.yml             Decap CMS collections config (Blog Posts)
src/
  _includes/
    base.njk             Shared layout: head, nav, footer
    post.njk              Blog post layout (wraps base.njk)
  index.njk               Home
  about/index.njk
  services/index.njk
  snapshot/index.njk
  snapshot/thank-you/index.njk
  case-studies/index.njk
  case-studies/planet-apparel/index.njk
  contact/index.njk
  contact/thank-you/index.njk
  404.njk
  sitemap.njk             Dynamic sitemap (auto-includes new blog posts)
  blog/
    index.njk             Paginated blog listing
    posts/
      posts.json          Shared front matter for all posts (layout, permalink pattern)
      *.md                 Individual posts
  images/uploads/          Where Decap-uploaded images land
  css/styles.css
  js/main.js
  favicon.svg
  robots.txt
```

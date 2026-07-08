# brianhafner.com — static site

A plain HTML/CSS site (no build step) implementing the new "AI Visibility Consultant" positioning from your brand refresh plan and web developer handoff docs: Home, About, Services (3 offers), AI Visibility Snapshot landing page, Case Studies (Planet Apparel), and Contact — with Netlify Forms wired up for the Snapshot request, contact form, and GEO checklist signup.

## Deploy to Netlify

**Fastest — drag and drop (no git required):**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole `site` folder onto the page.
3. Netlify gives you a live URL (like `random-name-123.netlify.app`) in seconds.

**Recommended — connect a Git repo (so future edits redeploy automatically):**
1. Push this folder to a new GitHub repo.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Build command: leave blank. Publish directory: `.` (already set in `netlify.toml`).
4. Deploy.

## Point your domain (brianhafner.com)

Once the site is live on Netlify:
1. In Netlify: **Site settings → Domain management → Add a domain** → enter `brianhafner.com`.
2. Netlify will show DNS records to add at your domain registrar (or you can transfer DNS to Netlify entirely for the simplest setup).
3. Your current WordPress host stays live until you actually switch DNS over — so there's no downtime risk while you test.
4. Netlify auto-provisions a free SSL certificate once DNS points to it.

## Forms

Three forms are wired for [Netlify Forms](https://docs.netlify.com/forms/setup/) — no backend code needed:
- **Contact** (`/contact/`) — name, email, company URL, service interest, message.
- **Snapshot request** (`/snapshot/`) — name, email, company URL, prompt.
- **GEO checklist signup** (on the homepage) — name, email, company URL.

Submissions appear in **Netlify → your site → Forms** and can be forwarded to your email or to a Zapier/Make automation from there (Site settings → Forms → Form notifications). Each has spam-honeypot protection built in.

**One thing to do after your first deploy:** open each form page once and submit a real test entry, then check Netlify's Forms dashboard to confirm all three forms were detected and the fields came through correctly.

## What's placeholder / needs your input before this looks fully "real"

- **Snapshot delivery window** — set to "3 business days" as a placeholder (matches what's live on the current site). Confirm or change it in `snapshot/index.html` and `services/index.html`.
- **GEO Retainer & Lead-to-Revenue Tracking pricing** — currently says "scoped per project after a discovery call" rather than a number, since no pricing was specified. Add real numbers if you want them public.
- **Sample Snapshot panel** on `/snapshot/` is an illustrative mockup, not a real redacted client report — swap in a real sanitized excerpt when you have one.
- **GEO Best Practices Checklist PDF** isn't built yet — the signup form on the homepage currently just captures the lead (no attached file to send). Add the real PDF and update the form's Netlify notification/Zapier step to deliver it.
- **Blog** isn't included — there was no existing blog content to migrate into a static build. Say the word if you want a simple blog section added later.
- **Case Studies** currently has just Planet Apparel. Add more `case-studies/<slug>/index.html` pages using that file as a template as new case studies are ready.

## File structure

```
/index.html                          Home
/about/index.html                    About
/services/index.html                 Services (3 offers + FAQ)
/snapshot/index.html                 AI Visibility Snapshot landing page
/snapshot/thank-you/index.html
/case-studies/index.html             Case studies index
/case-studies/planet-apparel/index.html
/contact/index.html                  Contact form
/contact/thank-you/index.html
/404.html
/css/styles.css                      All styling (brand colors: navy #1E1F50, coral #F08C8C, cream #F4E8DD)
/js/main.js                          Mobile nav toggle + service-param prefill
/favicon.svg
/robots.txt
/sitemap.xml
/netlify.toml
```

# Suraj Sunny — Personal Digital Exhibition

A responsive photography portfolio built for Cloudflare Workers, served at **photography.surajsunny.com**. The public site has an editorial masonry gallery, collection filters, and a full-screen lightbox. A private curator mode supports photo uploads and exhibition editing.

## Cloudflare services

- **Workers Static Assets** serves the frontend; the Worker serves the API.
- **R2** (binding `PHOTOS`, bucket `suraj-photography`) stores photographs under `works/` and gallery details in `_meta/gallery.json`. No database is needed.
- **Custom Domain** `photography.surajsunny.com` is declared in `wrangler.jsonc`.
- **Secret** `ADMIN_PASSWORD` enables curator sign-in.

The Worker shows built-in sample works until the first edit is saved.

## Deploy from the Cloudflare dashboard (no terminal)

1. **Workers & Pages → Create → Import a repository**, choose `ssunny-social/photography`, keep the defaults, and click **Deploy**.
2. After it deploys, open the Worker → **Settings → Variables and Secrets → Add**, type **Secret**, name `ADMIN_PASSWORD`, choose a password, and save.
3. Visit https://photography.surajsunny.com and use **Curator sign in** in the footer.

Every push to `main` redeploys automatically.

If a DNS record for `photography.surajsunny.com` already exists, delete it first so the custom domain can be attached.

## Deploy from a terminal (alternative)

```bash
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put ADMIN_PASSWORD
```

## Local development

Create `.dev.vars` (never commit it) containing `ADMIN_PASSWORD=choose-a-local-password`, then run `npm run dev`.

## Security

Never put API tokens or passwords in this repository. Curator sessions use a secure, HTTP-only, SameSite cookie signed with `ADMIN_PASSWORD`; without that secret, editing is disabled. Uploads are limited to 15 MB and to JPEG, PNG, WebP, or AVIF.

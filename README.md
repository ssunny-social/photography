# Suraj Sunny — Personal Digital Exhibition

A responsive photography portfolio built for Cloudflare Workers. The public site has an editorial masonry gallery, collection filters, and a full-screen lightbox. A private admin mode supports photo uploads and exhibition editing.

## Cloudflare services

- **Workers Static Assets** serves the frontend and API.
- **R2** stores photographs privately; the Worker serves them with immutable cache headers.
- **D1** stores exhibition details and photo metadata.
- **Worker secret** `ADMIN_PASSWORD` protects editing.

## First deployment

Install Node.js 18+ and authenticate Wrangler:

```bash
npm install
npx wrangler login
```

Create the storage resources:

```bash
npx wrangler d1 create suraj-photography
npx wrangler r2 bucket create suraj-photography
```

Copy the `database_id` printed by the first command into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Initialize the production database and set your admin password:

```bash
npm run db:remote
npx wrangler secret put ADMIN_PASSWORD
```

Deploy:

```bash
npm run deploy
```

## Custom domain

In the Cloudflare dashboard, open **Workers & Pages → suraj-photography → Settings → Domains & Routes → Add → Custom Domain**, then enter:

```text
photography.surajsunny.com
```

Cloudflare will create and manage the DNS record and certificate. Remove any pre-existing conflicting DNS record first.

## Local development

Create `.dev.vars` (never commit it):

```text
ADMIN_PASSWORD=choose-a-local-password
```

Then run:

```bash
npm run db:local
npm run dev
```

Open the site and choose **Curator sign in** at the bottom. Replace the sample works with your photographs and edit the exhibition details.

## Security

Never put API tokens or passwords in this repository. The admin session uses a secure, HTTP-only, SameSite cookie signed with `ADMIN_PASSWORD`. Uploaded images are limited to 15 MB and validated by media type.
Updated

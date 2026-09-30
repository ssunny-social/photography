const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...headers }
});

function cookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map(v => v.trim().split(/=(.*)/s)).filter(x => x[0]));
}

async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = cookies(request).photo_admin;
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return sig === await signature(expires, env.ADMIN_PASSWORD);
}

const clean = (value, max = 160) => String(value ?? "").trim().slice(0, max);

async function gallery(env) {
  const profile = await env.DB.prepare("SELECT artist,title,subtitle,statement,location FROM profile WHERE id=1").first();
  const result = await env.DB.prepare("SELECT id,object_key,sample_seed,title,category,location,year,story,featured,sort_order FROM photos ORDER BY sort_order, created_at DESC").all();
  return {
    profile,
    photos: result.results.map(p => ({
      id: p.id,
      src: p.object_key ? `/images/${encodeURIComponent(p.object_key)}` : null,
      sampleSeed: p.sample_seed,
      title: p.title,
      category: p.category,
      location: p.location,
      year: p.year,
      story: p.story,
      featured: Boolean(p.featured),
      sortOrder: p.sort_order
    }))
  };
}

async function api(request, env, url) {
  if (url.pathname === "/api/gallery" && request.method === "GET") return json(await gallery(env));
  if (url.pathname === "/api/session" && request.method === "GET") return json({ admin: await isAdmin(request, env) });

  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not configured." }, 503);
    const body = await request.json().catch(() => ({}));
    if (body.password !== env.ADMIN_PASSWORD) return json({ error: "Incorrect password." }, 401);
    const expires = String(Date.now() + 1000 * 60 * 60 * 12);
    const token = `${expires}.${await signature(expires, env.ADMIN_PASSWORD)}`;
    return json({ ok: true }, 200, { "set-cookie": `photo_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": "photo_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  }

  if (!await isAdmin(request, env)) return json({ error: "Admin sign-in required." }, 401);

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    const b = await request.json();
    await env.DB.prepare("UPDATE profile SET artist=?,title=?,subtitle=?,statement=?,location=? WHERE id=1")
      .bind(clean(b.artist,80) || "Suraj Sunny", clean(b.title,120) || "Untitled Exhibition", clean(b.subtitle), clean(b.statement,700), clean(b.location,100)).run();
    return json(await gallery(env));
  }

  if (url.pathname === "/api/photos" && request.method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return json({ error: "Choose a valid image." }, 400);
    if (file.size > 15_000_000) return json({ error: "Images must be smaller than 15 MB." }, 400);
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
    const ext = allowed[file.type];
    if (!ext) return json({ error: "Use JPEG, PNG, WebP, or AVIF." }, 400);
    const id = crypto.randomUUID();
    const objectKey = `${new Date().getUTCFullYear()}/${id}.${ext}`;
    await env.PHOTOS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: clean(file.name, 150) } });
    const maxOrder = await env.DB.prepare("SELECT COALESCE(MAX(sort_order),0) AS n FROM photos").first();
    await env.DB.prepare("INSERT INTO photos (id,object_key,title,category,location,year,story,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id, objectKey, clean(form.get("title"),120) || "Untitled", clean(form.get("category"),50) || "Personal", clean(form.get("location"),100), clean(form.get("year"),12), clean(form.get("story"),500), form.get("featured") === "true" ? 1 : 0, Number(maxOrder.n) + 10).run();
    return json(await gallery(env), 201);
  }

  const match = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
  if (match && request.method === "PUT") {
    const id = decodeURIComponent(match[1]);
    const b = await request.json();
    await env.DB.prepare("UPDATE photos SET title=?,category=?,location=?,year=?,story=?,featured=? WHERE id=?")
      .bind(clean(b.title,120)||"Untitled", clean(b.category,50)||"Personal", clean(b.location,100), clean(b.year,12), clean(b.story,500), b.featured ? 1 : 0, id).run();
    return json(await gallery(env));
  }
  if (match && request.method === "DELETE") {
    const id = decodeURIComponent(match[1]);
    const photo = await env.DB.prepare("SELECT object_key FROM photos WHERE id=?").bind(id).first();
    if (photo?.object_key) await env.PHOTOS.delete(photo.object_key);
    await env.DB.prepare("DELETE FROM photos WHERE id=?").bind(id).run();
    return json(await gallery(env));
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (url.pathname.startsWith("/images/") && request.method === "GET") {
        const key = decodeURIComponent(url.pathname.slice(8));
        if (key.includes("..")) return new Response("Not found", { status: 404 });
        const object = await env.PHOTOS.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        headers.set("x-content-type-options", "nosniff");
        return new Response(object.body, { headers });
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      if (url.pathname.startsWith("/api/")) return json({ error: "The gallery could not complete that request." }, 500);
      return new Response("Gallery unavailable", { status: 500 });
    }
  }
};

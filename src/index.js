// Photography exhibition Worker.
// Storage: a single R2 bucket (binding PHOTOS).
//   - Photographs are stored under "works/<year>/<id>.<ext>".
//   - Exhibition details and photo metadata live in "_meta/gallery.json".

const META_KEY = "_meta/gallery.json";

const DEFAULT_GALLERY = {
  profile: {
    artist: "Suraj Sunny",
    title: "Light, Held Still",
    subtitle: "A personal digital exhibition",
    statement: "An evolving collection of quiet observations — places, people, and the small moments between them.",
    location: "Online · 2026"
  },
  photos: [
    ["sample-1", 1, "After the Rain", "Street", "Lisbon", "2025", "A city briefly made new by rain and late afternoon light.", true],
    ["sample-2", 2, "Blue Hour", "Landscape", "Pacific Coast", "2025", "The last quiet color before the horizon disappears.", false],
    ["sample-3", 3, "Passing Through", "People", "Tokyo", "2024", "A moment of stillness inside the movement of the city.", false],
    ["sample-4", 4, "Soft Geometry", "Architecture", "Copenhagen", "2025", "Concrete, shadow, and the warmth of a single open window.", true],
    ["sample-5", 5, "Summer Table", "Still Life", "Home", "2024", "What remained after everyone had gone outside.", false],
    ["sample-6", 6, "Long Way Home", "Landscape", "Iceland", "2025", "A road with no promise except the next bend.", false],
    ["sample-7", 7, "Sunday, 7:12", "Street", "Paris", "2024", "The rare hour when the city belongs to no one.", false],
    ["sample-8", 8, "In Bloom", "Nature", "Kyoto", "2025", "A season measured in petals and passing weather.", true]
  ].map(([id, sampleSeed, title, category, location, year, story, featured]) => ({ id, sampleSeed, objectKey: null, title, category, location, year, story, featured }))
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }
});

const clean = (value, max = 160) => String(value ?? "").trim().slice(0, max);

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

async function loadGallery(env) {
  const object = await env.PHOTOS.get(META_KEY);
  if (!object) return structuredClone(DEFAULT_GALLERY);
  try { return await object.json(); } catch { return structuredClone(DEFAULT_GALLERY); }
}

async function saveGallery(env, gallery) {
  await env.PHOTOS.put(META_KEY, JSON.stringify(gallery), { httpMetadata: { contentType: "application/json" } });
}

function publicGallery(gallery) {
  return {
    profile: gallery.profile,
    photos: gallery.photos.map(p => ({
      id: p.id,
      src: p.objectKey ? `/images/${p.objectKey.split("/").map(encodeURIComponent).join("/")}` : null,
      sampleSeed: p.sampleSeed || null,
      title: p.title,
      category: p.category,
      location: p.location,
      year: p.year,
      story: p.story,
      featured: Boolean(p.featured)
    }))
  };
}

async function api(request, env, url) {
  if (url.pathname === "/api/gallery" && request.method === "GET") return json(publicGallery(await loadGallery(env)));
  if (url.pathname === "/api/session" && request.method === "GET") return json({ admin: await isAdmin(request, env), configured: Boolean(env.ADMIN_PASSWORD) });

  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ error: "Curator password has not been set up yet (ADMIN_PASSWORD secret)." }, 503);
    const body = await request.json().catch(() => ({}));
    if (body.password !== env.ADMIN_PASSWORD) return json({ error: "Incorrect password." }, 401);
    const expires = String(Date.now() + 1000 * 60 * 60 * 12);
    const token = `${expires}.${await signature(expires, env.ADMIN_PASSWORD)}`;
    return json({ ok: true }, 200, { "set-cookie": `photo_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": "photo_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  }

  if (!await isAdmin(request, env)) return json({ error: "Curator sign-in required." }, 401);

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    const b = await request.json();
    const gallery = await loadGallery(env);
    gallery.profile = {
      artist: clean(b.artist, 80) || "Suraj Sunny",
      title: clean(b.title, 120) || "Untitled Exhibition",
      subtitle: clean(b.subtitle),
      statement: clean(b.statement, 700),
      location: clean(b.location, 100)
    };
    await saveGallery(env, gallery);
    return json(publicGallery(gallery));
  }

  if (url.pathname === "/api/photos" && request.method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
    if (!(file instanceof File) || !allowed[file.type]) return json({ error: "Use a JPEG, PNG, WebP, or AVIF image." }, 400);
    if (file.size > 15_000_000) return json({ error: "Images must be smaller than 15 MB." }, 400);
    const id = crypto.randomUUID();
    const objectKey = `works/${new Date().getUTCFullYear()}/${id}.${allowed[file.type]}`;
    await env.PHOTOS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: clean(file.name, 150) } });
    const gallery = await loadGallery(env);
    gallery.photos.unshift({
      id, objectKey, sampleSeed: null,
      title: clean(form.get("title"), 120) || "Untitled",
      category: clean(form.get("category"), 50) || "Personal",
      location: clean(form.get("location"), 100),
      year: clean(form.get("year"), 12),
      story: clean(form.get("story"), 500),
      featured: form.get("featured") === "true"
    });
    await saveGallery(env, gallery);
    return json(publicGallery(gallery), 201);
  }

  const match = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const gallery = await loadGallery(env);
    const photo = gallery.photos.find(p => p.id === id);
    if (!photo) return json({ error: "Work not found." }, 404);

    if (request.method === "PUT") {
      const b = await request.json();
      photo.title = clean(b.title, 120) || "Untitled";
      photo.category = clean(b.category, 50) || "Personal";
      photo.location = clean(b.location, 100);
      photo.year = clean(b.year, 12);
      photo.story = clean(b.story, 500);
      photo.featured = Boolean(b.featured);
      await saveGallery(env, gallery);
      return json(publicGallery(gallery));
    }
    if (request.method === "DELETE") {
      if (photo.objectKey) await env.PHOTOS.delete(photo.objectKey);
      gallery.photos = gallery.photos.filter(p => p.id !== id);
      await saveGallery(env, gallery);
      return json(publicGallery(gallery));
    }
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);

      if (url.pathname.startsWith("/images/") && request.method === "GET") {
        const key = url.pathname.slice(8).split("/").map(decodeURIComponent).join("/");
        if (!key.startsWith("works/") || key.includes("..")) return new Response("Not found", { status: 404 });
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

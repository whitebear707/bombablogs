// Bomba Blogs admin API (runs on Render).
// The public site is static (GitHub Pages). This server only does the private part: you log in, and it saves
// your posts (data/foodie.json, data/travel.json) and photos (img/posts/…) straight into the GitHub repo.
// GitHub Pages republishes the site about a minute later.
//
// Settings (Render → Environment), never in the code:
//   ADMIN_PASSWORD   your login password
//   SESSION_SECRET   any long random text (signs the login)
//   GITHUB_TOKEN     fine-grained token with "Contents: read and write" on whitebear707/bombablogs only
//   GITHUB_REPO      whitebear707/bombablogs      (optional, this is the default)
//   GITHUB_BRANCH    main                         (optional)
//   ALLOWED_ORIGINS  https://whitebear707.github.io,https://bombablogs.com   (sites allowed to call this server)
const express = require('express');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || 'whitebear707/bombablogs';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const GH = process.env.GITHUB_API || 'https://api.github.com';
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://whitebear707.github.io').split(',').map(s => s.trim()).filter(Boolean);
const SECTIONS = { foodie: 'data/foodie.json', travel: 'data/travel.json' };

if (!ADMIN_PASSWORD || !SESSION_SECRET || !GITHUB_TOKEN) console.warn('⚠️  Missing ADMIN_PASSWORD, SESSION_SECRET or GITHUB_TOKEN — set them in Render → Environment.');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '12mb' }));

// ── Login ──
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
}
function verify(token) {
  if (!token || !SESSION_SECRET) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!verify(tok)) return res.status(401).json({ error: 'Please log in again.' });
  next();
}
const tries = new Map(); // ip -> { n, until }
app.post('/login', (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const t = tries.get(ip) || { n: 0, until: 0 };
  if (t.until > Date.now()) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
  const pw = String((req.body || {}).password || '');
  const ok = ADMIN_PASSWORD && pw.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(ADMIN_PASSWORD));
  if (!ok) {
    t.n++; if (t.n >= 8) { t.until = Date.now() + 15 * 60000; t.n = 0; }
    tries.set(ip, t);
    return res.status(401).json({ error: 'Wrong password.' });
  }
  tries.delete(ip);
  res.json({ token: sign({ admin: true, exp: Date.now() + 30 * 24 * 3600e3 }) });
});

// ── GitHub (contents API) ──
async function gh(path, opts = {}) {
  const r = await fetch(`${GH}/repos/${REPO}/contents/${path}${opts.method ? '' : `?ref=${BRANCH}`}`, {
    ...opts,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'bombablogs-admin', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !(opts.allow404 && r.status === 404)) { const e = new Error(j.message || `GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.status === 404 ? null : j;
}
async function readJSON(path) {
  const f = await gh(path, { allow404: true });
  if (!f) return { data: { items: [] }, sha: null };
  return { data: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')), sha: f.sha };
}
async function writeFile(path, buf, message, sha) {
  return gh(path, { method: 'PUT', body: JSON.stringify({ message, content: buf.toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) }) });
}
async function deleteFile(path, message) {
  const f = await gh(path, { allow404: true });
  if (!f) return;
  await gh(path, { method: 'DELETE', body: JSON.stringify({ message, sha: f.sha, branch: BRANCH }) });
}
// One save at a time, so two quick saves can't overwrite each other
let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));

// ── Posts ──
const str = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const list = (v, n = 20) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => str(x, 120)).filter(Boolean).slice(0, n);
const slug = s => str(s, 80).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post';
// Google Maps: accept the "Embed a map" HTML (or just its URL) → it becomes the map on the post.
// A normal Google Maps share link is kept only as the "Open in Google Maps" button. Anything else is refused.
function cleanMap(s) {
  s = String(s || '').trim();
  if (!s) return {};
  const m = s.match(/src\s*=\s*["']([^"']+)["']/i);
  const u = (m ? m[1] : s).replace(/&amp;/g, '&').trim();
  if (u.length > 2000) return { bad: true };
  if (/^https:\/\/www\.google\.com\/maps\/embed(\/v1\/[a-z]+)?\?[^\s"'<>]+$/i.test(u)) return { map: u };
  if (/^https:\/\/(www\.google\.com\/maps[/?][^\s"'<>]*|maps\.google\.com\/[^\s"'<>]*|maps\.app\.goo\.gl\/[^\s"'<>]+|goo\.gl\/maps\/[^\s"'<>]+)$/i.test(u)) return { mapLink: u };
  return { bad: true };
}
function cleanItem(sec, b) {
  const rating = Math.max(0, Math.min(5, Math.round((Number(b.rating) || 0) * 2) / 2));
  const it = {
    id: b.id ? slug(b.id) : '',
    name: str(b.name, 120), city: str(b.city, 80), country: str(b.country, 60), address: str(b.address, 200),
    rating, date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
    video: str(b.video, 200),
    photos: (Array.isArray(b.photos) ? b.photos : []).map(p => str(p, 200)).filter(p => /^img\/posts\/[a-z0-9._-]+$/i.test(p) || /^https:\/\//.test(p)).slice(0, 30),
    review: str(b.review, 6000), review_es: str(b.review_es, 6000),
  };
  const mp = cleanMap(b.map);
  if (mp.bad) it.mapBad = true; else Object.assign(it, mp);
  if (sec === 'foodie') { it.cuisine = str(b.cuisine, 60); it.price = ['$', '$$', '$$$', '$$$$'].includes(b.price) ? b.price : ''; it.dishes = list(b.dishes); }
  else { it.kind = ['Place', 'Hotel', 'Motel', 'Airbnb'].includes(b.kind) ? b.kind : 'Place'; it.pricePerNight = str(b.pricePerNight, 40); it.highlights = list(b.highlights); }
  Object.keys(it).forEach(k => { if (it[k] === '' || (Array.isArray(it[k]) && !it[k].length && k !== 'photos')) delete it[k]; });
  return it;
}
app.get('/posts/:sec', auth, async (req, res) => {
  const path = SECTIONS[req.params.sec]; if (!path) return res.status(404).json({ error: 'Unknown section' });
  try { res.json((await readJSON(path)).data); } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/posts/:sec', auth, (req, res) => {
  const sec = req.params.sec, path = SECTIONS[sec]; if (!path) return res.status(404).json({ error: 'Unknown section' });
  const it = cleanItem(sec, req.body || {});
  if (!it.name) return res.status(400).json({ error: 'The name is required.' });
  if (it.mapBad) return res.status(400).json({ error: "That doesn't look like a Google Maps embed code or link. In Google Maps use Share → Embed a map → Copy HTML." });
  serial(async () => {
    const { data, sha } = await readJSON(path);
    data.items = data.items || [];
    const editing = it.id && data.items.some(x => x.id === it.id);
    if (!editing) {                       // new post: make a unique id from the name
      let base = slug(it.name), id = base, n = 2;
      while (data.items.some(x => x.id === id)) id = `${base}-${n++}`;
      it.id = id;
      data.items.unshift(it);
    } else data.items = data.items.map(x => x.id === it.id ? it : x);
    await writeFile(path, Buffer.from(JSON.stringify(data, null, 2) + '\n'), `${editing ? 'Update' : 'Add'} ${sec}: ${it.name}`, sha);
    return it;
  }).then(item => res.json({ success: true, item })).catch(e => res.status(e.status === 409 ? 409 : 502).json({ error: e.message }));
});
app.delete('/posts/:sec/:id', auth, (req, res) => {
  const sec = req.params.sec, path = SECTIONS[sec]; if (!path) return res.status(404).json({ error: 'Unknown section' });
  serial(async () => {
    const { data, sha } = await readJSON(path);
    const it = (data.items || []).find(x => x.id === req.params.id);
    if (!it) return null;
    data.items = data.items.filter(x => x.id !== req.params.id);
    await writeFile(path, Buffer.from(JSON.stringify(data, null, 2) + '\n'), `Delete ${sec}: ${it.name}`, sha);
    for (const p of it.photos || []) if (/^img\/posts\//.test(p)) await deleteFile(p, `Delete photo of ${it.name}`).catch(() => {});
    return it;
  }).then(it => it ? res.json({ success: true }) : res.status(404).json({ error: 'Not found' })).catch(e => res.status(502).json({ error: e.message }));
});

// ── Photos (the admin page shrinks them first; we only accept JPEG/PNG/WebP) ──
app.post('/upload', auth, (req, res) => {
  const m = String((req.body || {}).data || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ error: 'Send a JPEG, PNG or WebP photo.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'Photo too big (max 6 MB).' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `img/posts/${slug(req.body.name || 'photo').slice(0, 40)}-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}.${ext}`;
  serial(() => writeFile(name, buf, `Photo: ${name}`))
    .then(() => res.json({ success: true, path: name }))
    .catch(e => res.status(502).json({ error: e.message }));
});

app.get('/', (req, res) => res.json({ ok: true, service: 'bombablogs-admin' }));
app.listen(PORT, () => console.log(`Bomba Blogs admin on port ${PORT}`));

// Bomba Blogs. Content lives in data/*.json: site.json (channel link), foodie.json, travel.json.
const T = {
  en: {
    home: 'Home', foodie: 'Foodie', travel: 'Travel', subscribe: 'Subscribe', back: '← Back',
    welcomeTitle: 'Welcome to Bomba Blogs', welcomeText: 'Good food, good trips and honest ratings — straight from the channel.',
    foodieCard: 'Restaurants & food spots with ratings, photos and videos.', travelCard: 'Places I visited and the hotels, motels & Airbnbs I stayed at.',
    explore: 'Explore', latest: 'Latest posts',
    foodieTitle: 'Foodie', foodieSub: 'Restaurants, street food & everything worth eating',
    travelTitle: 'Travel', travelSub: 'Places, hotels, motels & Airbnbs — with ratings',
    search: 'Search…', allCities: 'All cities', allTypes: 'All food', allKinds: 'Everything', sortNew: 'Newest first', sortTop: 'Best rated',
    count: n => `${n} post${n === 1 ? '' : 's'}`, none: 'Nothing matches that search.',
    video: 'The video', noVideo: 'Video coming soon', photos: 'Photos', where: 'Where', openMaps: 'Open in Google Maps',
    dishes: 'What I ordered', highlights: 'Highlights', review: 'My review', perNight: 'Per night', notFound: 'Post not found.',
    sample: 'SAMPLE', watch: '▶ Video', footer: 'Food, travel & good vibes.',
    kinds: { Place: 'Place', Hotel: 'Hotel', Motel: 'Motel', Airbnb: 'Airbnb' },
  },
  es: {
    home: 'Inicio', foodie: 'Foodie', travel: 'Viajes', subscribe: 'Suscríbete', back: '← Regresar',
    welcomeTitle: 'Bienvenidos a Bomba Blogs', welcomeText: 'Buena comida, buenos viajes y calificaciones honestas — directo del canal.',
    foodieCard: 'Restaurantes y lugares de comida con calificación, fotos y videos.', travelCard: 'Lugares que visité y los hoteles, moteles y Airbnbs donde me quedé.',
    explore: 'Ver', latest: 'Lo más reciente',
    foodieTitle: 'Foodie', foodieSub: 'Restaurantes, comida callejera y todo lo que vale la pena',
    travelTitle: 'Viajes', travelSub: 'Lugares, hoteles, moteles y Airbnbs — con calificación',
    search: 'Buscar…', allCities: 'Todas las ciudades', allTypes: 'Toda la comida', allKinds: 'Todo', sortNew: 'Más recientes', sortTop: 'Mejor calificados',
    count: n => `${n} publicaci${n === 1 ? 'ón' : 'ones'}`, none: 'Nada coincide con esa búsqueda.',
    video: 'El video', noVideo: 'Video muy pronto', photos: 'Fotos', where: 'Dónde', openMaps: 'Abrir en Google Maps',
    dishes: 'Lo que pedí', highlights: 'Lo mejor', review: 'Mi reseña', perNight: 'Por noche', notFound: 'Publicación no encontrada.',
    sample: 'EJEMPLO', watch: '▶ Video', footer: 'Comida, viajes y buena vibra.',
    kinds: { Place: 'Lugar', Hotel: 'Hotel', Motel: 'Motel', Airbnb: 'Airbnb' },
  },
};
const KIND_ICON = { Place: '📍', Hotel: '🏨', Motel: '🛏️', Airbnb: '🏡' };
let LANG = (() => { try { return localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2); } catch (e) { return 'en'; } })();
if (!T[LANG]) LANG = 'en';
const t = k => T[LANG][k];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const PAGE = document.body.dataset.page;          // home | foodie | travel | item

function ytId(v) {
  if (!v) return '';
  const m = String(v).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(v) ? v : '');
}
function stars(r) {
  const n = Math.round((Number(r) || 0) * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += n >= i ? '★' : n >= i - .5 ? '<span class="half">★</span>' : '<span class="off">★</span>';
  return `<span class="stars" title="${n}/5">${s}</span>`;
}
const reviewOf = r => (LANG === 'es' && r.review_es) || r.review || r.review_es || '';
const coverOf = r => (r.photos && r.photos.length) ? r.photos[0] : (ytId(r.video) ? `https://i.ytimg.com/vi/${ytId(r.video)}/hqdefault.jpg` : '');
const kindLabel = k => (t('kinds')[k] || k || '');
const place = r => [r.city, r.country].filter(Boolean).join(', ');
const tagOf = (sec, r) => sec === 'foodie' ? (r.cuisine || '') : `${KIND_ICON[r.kind] || ''} ${kindLabel(r.kind)}`.trim();

const DATA = { site: { youtube: 'https://www.youtube.com/' }, foodie: [], travel: [] };
async function getJSON(f) { const r = await fetch(f, { cache: 'no-cache' }); if (!r.ok) throw new Error(f); return r.json(); }
async function load() {
  const [site, foodie, travel] = await Promise.all([getJSON('data/site.json').catch(() => ({})), getJSON('data/foodie.json').catch(() => ({ items: [] })), getJSON('data/travel.json').catch(() => ({ items: [] }))]);
  DATA.site = { ...DATA.site, ...site }; DATA.foodie = foodie.items || []; DATA.travel = travel.items || [];
}
function setLang(l) { LANG = l; try { localStorage.setItem('lang', l); } catch (e) {} render(); }
function chrome() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-yt]').forEach(a => { a.href = DATA.site.youtube; });
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === PAGE || (PAGE === 'item' && a.dataset.nav === new URLSearchParams(location.search).get('s'))));
  const lb = $('lang-btn'); if (lb) { lb.textContent = LANG === 'en' ? 'ES' : 'EN'; lb.onclick = () => setLang(LANG === 'en' ? 'es' : 'en'); }
}
function card(sec, r) {
  const img = coverOf(r);
  return `<a class="card" href="item.html?s=${sec}&id=${encodeURIComponent(r.id)}">
    <div class="thumb">${img ? `<img src="${esc(img)}" alt="${esc(r.name)}" loading="lazy">` : `<div class="noimg"><span>${sec === 'foodie' ? '🍔' : (KIND_ICON[r.kind] || '✈️')}</span></div>`}
      <span class="badge-rate">★ ${esc(r.rating)}</span>${r.sample ? `<span class="sample">${t('sample')}</span>` : ''}${ytId(r.video) ? `<span class="play">${t('watch')}</span>` : ''}</div>
    <div class="body"><h3>${esc(r.name)}</h3><div>${stars(r.rating)}</div>
      <div class="meta">📍 ${esc(place(r))}${r.price ? ' · ' + esc(r.price) : ''}${r.pricePerNight ? ' · ' + esc(r.pricePerNight) : ''}</div>
      <div style="margin-top:6px;">${tagOf(sec, r) ? `<span class="chip">${esc(tagOf(sec, r))}</span>` : ''}</div></div></a>`;
}

// ── Welcome page ──
function renderHome() {
  const latest = [...DATA.foodie.map(r => ['foodie', r]), ...DATA.travel.map(r => ['travel', r])]
    .sort((a, b) => String(b[1].date || '').localeCompare(String(a[1].date || ''))).slice(0, 6);
  $('latest').innerHTML = latest.map(([sec, r]) => card(sec, r)).join('');
  $('n-foodie').textContent = t('count')(DATA.foodie.length);
  $('n-travel').textContent = t('count')(DATA.travel.length);
}

// ── Foodie / Travel lists ──
function setupList(sec) {
  const items = DATA[sec];
  const uniq = f => [...new Set(items.map(f).filter(Boolean))].sort();
  const sel = (id, all, vals, label = v => v) => { const el = $(id), cur = el.value; el.innerHTML = `<option value="">${t(all)}</option>` + vals.map(v => `<option value="${esc(v)}">${esc(label(v))}</option>`).join(''); el.value = cur; };
  $('q').placeholder = t('search');
  sel('f1', 'allCities', uniq(r => r.city));
  if (sec === 'foodie') sel('f2', 'allTypes', uniq(r => r.cuisine));
  else sel('f2', 'allKinds', uniq(r => r.kind), v => `${KIND_ICON[v] || ''} ${kindLabel(v)}`);
  const s = $('sort'), cur = s.value; s.innerHTML = `<option value="new">${t('sortNew')}</option><option value="top">${t('sortTop')}</option>`; s.value = cur || 'new';
  const run = () => {
    const q = $('q').value.trim().toLowerCase(), f1 = $('f1').value, f2 = $('f2').value;
    let list = items.filter(r => (!f1 || r.city === f1) && (!f2 || (sec === 'foodie' ? r.cuisine : r.kind) === f2) &&
      (!q || [r.name, r.city, r.country, r.cuisine, r.kind, r.address, ...(r.dishes || []), ...(r.highlights || [])].join(' ').toLowerCase().includes(q)));
    list.sort($('sort').value === 'top' ? (a, b) => (b.rating || 0) - (a.rating || 0) : (a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    $('count').textContent = t('count')(list.length);
    $('grid').innerHTML = list.length ? list.map(r => card(sec, r)).join('') : `<div class="empty">${t('none')}</div>`;
  };
  ['q', 'f1', 'f2', 'sort'].forEach(id => $(id).oninput = run);
  run();
}

// ── One post ──
function renderItem() {
  const qs = new URLSearchParams(location.search), sec = qs.get('s') === 'travel' ? 'travel' : 'foodie';
  const r = DATA[sec].find(x => x.id === qs.get('id'));
  const el = $('page'), backHref = `${sec}.html`;
  if (!r) { el.innerHTML = `<a class="back" href="${backHref}">${t('back')}</a><div class="empty">${t('notFound')}</div>`; return; }
  document.title = `${r.name} — Bomba Blogs`;
  const vid = ytId(r.video), list = sec === 'foodie' ? r.dishes : r.highlights;
  const mapsQ = encodeURIComponent(r.mapsQuery || `${r.name}, ${r.address || place(r)}`);
  el.innerHTML = `
    <a class="back" href="${backHref}">${t('back')} · ${t(sec)}</a>
    <div class="rhead">
      <div><h1>${esc(r.name)}</h1>
        <div class="meta" style="margin-top:6px;">📍 ${esc(place(r))}${tagOf(sec, r) ? ' · ' + esc(tagOf(sec, r)) : ''}${r.price ? ' · ' + esc(r.price) : ''}${r.sample ? ` · <span class="sample" style="position:static;">${t('sample')}</span>` : ''}</div></div>
      <div class="score"><b>${esc(r.rating)}</b>${stars(r.rating)}</div>
    </div>
    <div class="layout">
      <div>
        <div class="box"><h2>${t('video')}</h2>${vid
          ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(r.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
          : `<div class="novideo">🎬 ${t('noVideo')}</div>`}</div>
        ${reviewOf(r) ? `<div class="box"><h2>${t('review')}</h2><div>${esc(reviewOf(r)).replace(/\n/g, '<br>')}</div></div>` : ''}
        ${r.photos && r.photos.length ? `<div class="box"><h2>${t('photos')}</h2><div class="photos">${r.photos.map(p => `<img src="${esc(p)}" alt="${esc(r.name)}" loading="lazy" onclick="zoom(this.src)">`).join('')}</div></div>` : ''}
      </div>
      <div>
        ${r.pricePerNight ? `<div class="box"><h2>${t('perNight')}</h2><div style="font-size:1.4rem;font-weight:800;color:var(--gold2);">${esc(r.pricePerNight)}</div></div>` : ''}
        <div class="box"><h2>${t('where')}</h2>
          <div style="margin-bottom:10px;">${esc(r.address || place(r))}</div>
          <iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${mapsQ}&output=embed"></iframe>
          <a class="btn btn-gold" style="margin-top:12px;" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}">🗺 ${t('openMaps')}</a></div>
        ${list && list.length ? `<div class="box"><h2>${t(sec === 'foodie' ? 'dishes' : 'highlights')}</h2><ul class="dishes">${list.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        <a class="btn btn-yt" data-yt target="_blank" rel="noopener" href="${esc(DATA.site.youtube)}">▶ ${t('subscribe')}</a>
      </div>
    </div>`;
}
function zoom(src) { const lb = $('lightbox'); lb.querySelector('img').src = src; lb.classList.add('on'); }

function render() {
  if (PAGE === 'home') renderHome();
  else if (PAGE === 'foodie' || PAGE === 'travel') setupList(PAGE);
  else renderItem();
  chrome();
}
load().then(render).catch(() => { const g = $('grid') || $('page') || $('latest'); if (g) g.innerHTML = '<div class="empty">Could not load.</div>'; });

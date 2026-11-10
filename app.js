// Bomba Blogs — restaurant reviews. All content lives in data/restaurants.json.
const T = {
  en: { tagline: 'Restaurant reviews, ratings & the spots worth the trip', search: 'Search restaurant, dish or city…', allCities: 'All cities', allTypes: 'All food',
    sortNew: 'Newest first', sortTop: 'Best rated', places: n => `${n} place${n === 1 ? '' : 's'}`, none: 'No restaurants match that search.',
    subscribe: 'Subscribe', back: '← All restaurants', video: 'The video', noVideo: 'Video coming soon', photos: 'Photos', where: 'Where', openMaps: 'Open in Google Maps',
    tried: 'What I ordered', review: 'My review', notFound: 'Restaurant not found.', sample: 'SAMPLE', watch: '▶ Video', footer: 'Food, travel & good vibes.' },
  es: { tagline: 'Reseñas de restaurantes, calificaciones y los lugares que valen la pena', search: 'Busca restaurante, platillo o ciudad…', allCities: 'Todas las ciudades', allTypes: 'Toda la comida',
    sortNew: 'Más recientes', sortTop: 'Mejor calificados', places: n => `${n} lugar${n === 1 ? '' : 'es'}`, none: 'Ningún restaurante coincide con esa búsqueda.',
    subscribe: 'Suscríbete', back: '← Todos los restaurantes', video: 'El video', noVideo: 'Video muy pronto', photos: 'Fotos', where: 'Dónde', openMaps: 'Abrir en Google Maps',
    tried: 'Lo que pedí', review: 'Mi reseña', notFound: 'Restaurante no encontrado.', sample: 'EJEMPLO', watch: '▶ Video', footer: 'Comida, viajes y buena vibra.' },
};
let LANG = (() => { try { return localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2); } catch (e) { return 'en'; } })();
if (!T[LANG]) LANG = 'en';
const t = k => T[LANG][k];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);

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
function review(r) { return (LANG === 'es' && r.review_es) || r.review || r.review_es || ''; }
function cover(r) {
  if (r.photos && r.photos.length) return r.photos[0];
  const id = ytId(r.video); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

async function loadData() {
  const res = await fetch('data/restaurants.json', { cache: 'no-cache' });
  return res.json();
}
function setLang(l) { LANG = l; try { localStorage.setItem('lang', l); } catch (e) {} render(); }
function chrome(data) {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-yt]').forEach(a => { a.href = data.channel.youtube; });
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  const lb = $('lang-btn'); if (lb) { lb.textContent = LANG === 'en' ? 'ES' : 'EN'; lb.onclick = () => setLang(LANG === 'en' ? 'es' : 'en'); }
}

// ── Home ──
let DATA = null;
function renderHome() {
  const q = $('q').value.trim().toLowerCase(), city = $('city').value, type = $('type').value, sort = $('sort').value;
  let list = DATA.restaurants.filter(r =>
    (!city || r.city === city) && (!type || r.cuisine === type) &&
    (!q || [r.name, r.city, r.cuisine, r.address, (r.dishes || []).join(' ')].join(' ').toLowerCase().includes(q)));
  list.sort(sort === 'top' ? (a, b) => (b.rating || 0) - (a.rating || 0) : (a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  $('count').textContent = t('places')(list.length);
  $('grid').innerHTML = list.length ? list.map(r => {
    const img = cover(r);
    return `<a class="card" href="r.html?id=${encodeURIComponent(r.id)}">
      <div class="thumb">${img ? `<img src="${esc(img)}" alt="${esc(r.name)}" loading="lazy">` : `<div class="noimg"><img src="img/icon.png" alt=""></div>`}
        <span class="badge-rate">★ ${esc(r.rating)}</span>${r.sample ? `<span class="sample">${t('sample')}</span>` : ''}${ytId(r.video) ? `<span class="play">${t('watch')}</span>` : ''}</div>
      <div class="body"><h3>${esc(r.name)}</h3><div>${stars(r.rating)}</div>
        <div class="meta">📍 ${esc(r.city)}${r.price ? ' · ' + esc(r.price) : ''}</div>
        <div style="margin-top:6px;">${r.cuisine ? `<span class="chip">${esc(r.cuisine)}</span>` : ''}</div></div></a>`;
  }).join('') : `<div class="empty">${t('none')}</div>`;
}
function fillSelect(id, values, allKey) {
  const el = $(id), cur = el.value;
  el.innerHTML = `<option value="">${t(allKey)}</option>` + values.map(v => `<option>${esc(v)}</option>`).join('');
  el.value = cur;
}
function setupHome() {
  $('q').placeholder = t('search');
  const uniq = k => [...new Set(DATA.restaurants.map(r => r[k]).filter(Boolean))].sort();
  fillSelect('city', uniq('city'), 'allCities');
  fillSelect('type', uniq('cuisine'), 'allTypes');
  $('sort').innerHTML = `<option value="new">${t('sortNew')}</option><option value="top">${t('sortTop')}</option>`;
  ['q', 'city', 'type', 'sort'].forEach(id => $(id).oninput = renderHome);
  renderHome();
}

// ── Restaurant page ──
function renderRestaurant() {
  const id = new URLSearchParams(location.search).get('id');
  const r = DATA.restaurants.find(x => x.id === id);
  const el = $('page');
  if (!r) { el.innerHTML = `<a class="back" href="index.html">${t('back')}</a><div class="empty">${t('notFound')}</div>`; return; }
  document.title = `${r.name} — Bomba Blogs`;
  const vid = ytId(r.video);
  const mapsQ = encodeURIComponent(r.mapsQuery || `${r.name}, ${r.address || r.city}`);
  el.innerHTML = `
    <a class="back" href="index.html">${t('back')}</a>
    <div class="rhead">
      <div><h1>${esc(r.name)}</h1>
        <div class="meta" style="margin-top:6px;">📍 ${esc(r.city)}${r.cuisine ? ' · ' + esc(r.cuisine) : ''}${r.price ? ' · ' + esc(r.price) : ''}${r.sample ? ` · <span class="sample" style="position:static;">${t('sample')}</span>` : ''}</div></div>
      <div class="score"><b>${esc(r.rating)}</b>${stars(r.rating)}</div>
    </div>
    <div class="layout">
      <div>
        <div class="box"><h2>${t('video')}</h2>${vid
          ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(r.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
          : `<div class="novideo">🎬 ${t('noVideo')}</div>`}</div>
        ${review(r) ? `<div class="box"><h2>${t('review')}</h2><div>${esc(review(r)).replace(/\n/g, '<br>')}</div></div>` : ''}
        ${r.photos && r.photos.length ? `<div class="box"><h2>${t('photos')}</h2><div class="photos">${r.photos.map(p => `<img src="${esc(p)}" alt="${esc(r.name)}" loading="lazy" onclick="zoom(this.src)">`).join('')}</div></div>` : ''}
      </div>
      <div>
        <div class="box"><h2>${t('where')}</h2>
          <div style="margin-bottom:10px;">${esc(r.address || r.city)}</div>
          <iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${mapsQ}&output=embed"></iframe>
          <a class="btn btn-gold" style="margin-top:12px;" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}">🗺 ${t('openMaps')}</a></div>
        ${r.dishes && r.dishes.length ? `<div class="box"><h2>${t('tried')}</h2><ul class="dishes">${r.dishes.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        <a class="btn btn-yt" data-yt target="_blank" rel="noopener" href="${esc(DATA.channel.youtube)}">▶ ${t('subscribe')}</a>
      </div>
    </div>`;
}
function zoom(src) { const lb = $('lightbox'); lb.querySelector('img').src = src; lb.classList.add('on'); }

function render() {
  chrome(DATA);
  if ($('grid')) setupHome(); else renderRestaurant();
  chrome(DATA);
}
loadData().then(d => { DATA = d; render(); }).catch(() => { const g = $('grid') || $('page'); if (g) g.innerHTML = '<div class="empty">Could not load restaurants.</div>'; });

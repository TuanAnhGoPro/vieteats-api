const CITIES = [
  'Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hoi An', 'Hue',
  'Da Lat', 'Nha Trang', 'Can Tho', 'Hai Phong', 'Vung Tau', 'Other',
];

const CATEGORIES = [
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'street-food', label: 'Street food' },
  { value: 'bar', label: 'Bar / pub' },
  { value: 'dessert', label: 'Dessert' },
];

const state = {
  token: localStorage.getItem('veToken') || null,
  userName: localStorage.getItem('veUserName') || null,
  myUserId: localStorage.getItem('veUserId') || null,
  places: [],
};

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const authArea = $('authArea');
const placesGrid = $('placesGrid');
const emptyState = $('emptyState');
const resultCount = $('resultCount');
const filterCity = $('filterCity');
const filterCategory = $('filterCategory');

const authDialog = $('authDialog');
const authForm = $('authForm');
const authTitle = $('authTitle');
const authError = $('authError');
const nameFieldWrap = $('nameFieldWrap');
let authMode = 'login';

const placeDialog = $('placeDialog');
const placeForm = $('placeForm');
const placeError = $('placeError');

// ---------- Init selects ----------
function fillSelect(select, options, includeAll) {
  select.innerHTML = '';
  if (includeAll) {
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All';
    select.appendChild(optAll);
  }
  options.forEach((opt) => {
    const el = document.createElement('option');
    if (typeof opt === 'string') {
      el.value = opt;
      el.textContent = opt;
    } else {
      el.value = opt.value;
      el.textContent = opt.label;
    }
    select.appendChild(el);
  });
}

fillSelect(filterCity, CITIES, true);
fillSelect(filterCategory, CATEGORIES, true);
fillSelect($('placeCity'), CITIES, false);
fillSelect($('placeCategory'), CATEGORIES, false);

// ---------- Auth UI ----------
function renderAuthArea() {
  if (state.token) {
    authArea.innerHTML = `
      <span class="tagline">Hi, ${state.userName || 'there'}</span>
      <button class="btn btn-ghost" id="btnLogout">Log out</button>
    `;
    $('btnLogout').addEventListener('click', logout);
  } else {
    authArea.innerHTML = `
      <button class="btn btn-ghost" id="btnLogin">Log in</button>
      <button class="btn btn-solid" id="btnRegister">Sign up</button>
    `;
    $('btnLogin').addEventListener('click', () => openAuthDialog('login'));
    $('btnRegister').addEventListener('click', () => openAuthDialog('register'));
  }
}

function openAuthDialog(mode) {
  authMode = mode;
  authError.hidden = true;
  authForm.reset();
  if (mode === 'register') {
    authTitle.textContent = 'Create account';
    nameFieldWrap.hidden = false;
    $('btnSubmitAuth').textContent = 'Create account';
  } else {
    authTitle.textContent = 'Log in';
    nameFieldWrap.hidden = true;
    $('btnSubmitAuth').textContent = 'Log in';
  }
  authDialog.showModal();
}

$('btnLogin').addEventListener('click', () => openAuthDialog('login'));
$('btnRegister').addEventListener('click', () => openAuthDialog('register'));
$('btnCancelAuth').addEventListener('click', () => authDialog.close());

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.hidden = true;
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const name = $('authName').value.trim();

  const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const body = authMode === 'register' ? { name, email, password } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');

    state.token = data.token;
    state.userName = data.user.name;
    state.myUserId = data.user.id;
    localStorage.setItem('veToken', data.token);
    localStorage.setItem('veUserName', data.user.name);
    localStorage.setItem('veUserId', data.user.id);
    renderAuthArea();
    renderPlaces();
    authDialog.close();
  } catch (err) {
    authError.textContent = err.message;
    authError.hidden = false;
  }
});

function logout() {
  state.token = null;
  state.userName = null;
  state.myUserId = null;
  localStorage.removeItem('veToken');
  localStorage.removeItem('veUserName');
  localStorage.removeItem('veUserId');
  renderAuthArea();
  renderPlaces();
}

// ---------- Add place ----------
$('btnOpenAdd').addEventListener('click', () => {
  if (!state.token) {
    openAuthDialog('login');
    return;
  }
  placeError.hidden = true;
  placeForm.reset();
  placeDialog.showModal();
});
$('btnCancelPlace').addEventListener('click', () => placeDialog.close());

placeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  placeError.hidden = true;
  const payload = {
    name: $('placeName').value.trim(),
    address: $('placeAddress').value.trim(),
    city: $('placeCity').value,
    category: $('placeCategory').value,
    priceRange: $('placePrice').value,
    description: $('placeDescription').value.trim(),
  };
  try {
    const res = await fetch('/api/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not save this place');
    placeDialog.close();
    await loadPlaces();
  } catch (err) {
    placeError.textContent = err.message;
    placeError.hidden = false;
  }
});

async function deletePlace(id) {
  if (!confirm('Remove this place from the list?')) return;
  await fetch(`/api/places/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${state.token}` },
  });
  await loadPlaces();
}

// ---------- Rendering ----------
const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || value;

function mapsUrl(place) {
  const query = encodeURIComponent(`${place.name}, ${place.address}, ${place.city}, Vietnam`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function renderPlaces() {
  const city = filterCity.value;
  const category = filterCategory.value;
  const filtered = state.places.filter(
    (p) => (!city || p.city === city) && (!category || p.category === category)
  );

  resultCount.textContent = `${filtered.length} places`;
  emptyState.hidden = filtered.length !== 0;
  placesGrid.innerHTML = '';

  filtered.forEach((place) => {
    const card = document.createElement('article');
    card.className = 'card';

    const isOwner = state.token && place.owner === state.myUserId;

    card.innerHTML = `
      <div class="card-top">
        <h3>${escapeHtml(place.name)}</h3>
        <span class="badge badge-${place.category}">${categoryLabel(place.category)}</span>
      </div>
      <p class="city">${escapeHtml(place.city)}</p>
      <p class="address">${escapeHtml(place.address)}</p>
      ${place.description ? `<p class="description">${escapeHtml(place.description)}</p>` : ''}
      <div class="card-bottom">
        <span class="price">${escapeHtml(place.priceRange || '$')}</span>
        <a class="map-link" href="${mapsUrl(place)}" target="_blank" rel="noopener">View on map ↗</a>
      </div>
      ${isOwner ? `<div class="card-owner-actions"><button data-id="${place._id}" class="btn-delete">Delete my listing</button></div>` : ''}
    `;

    const delBtn = card.querySelector('.btn-delete');
    if (delBtn) delBtn.addEventListener('click', () => deletePlace(place._id));

    placesGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadPlaces() {
  const res = await fetch('/api/places');
  state.places = await res.json();
  renderPlaces();
}

filterCity.addEventListener('change', renderPlaces);
filterCategory.addEventListener('change', renderPlaces);

// ---------- Boot ----------
renderAuthArea();
loadPlaces();

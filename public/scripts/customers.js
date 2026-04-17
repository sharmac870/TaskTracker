const customerForm = document.getElementById('customer-form');
const customerList = document.getElementById('customer-list');
const customerRowTemplate = document.getElementById('customer-row-template');
const filterSearch = document.getElementById('filter-customer-search');
const filterSector = document.getElementById('filter-customer-sector');
const filterRegion = document.getElementById('filter-customer-region');
const filterStatus = document.getElementById('filter-customer-status');
const filterResult = document.getElementById('customer-filter-result');
const clearFiltersBtn = document.getElementById('clear-customer-filters');
const resetFormBtn = document.getElementById('reset-customer-form');
const statsContainer = document.getElementById('customer-stats');
const heroTotal = document.getElementById('hero-total');
const statTotal = document.getElementById('stat-total');

let customers = JSON.parse(document.getElementById('initial-customers').textContent || '[]');
let activeStatusFilter = '';
let editingId = null;

async function parseJson(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : null;
}

function redirectToLogin() {
  const nextPath = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${nextPath}`);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getFilteredCustomers() {
  const search = filterSearch.value.trim().toLowerCase();
  const sector = filterSector.value;
  const region = filterRegion.value;
  const status = filterStatus.value || activeStatusFilter;

  return customers.filter((c) => {
    if (search && ![c.name, c.referencePoint, c.product, c.notes].some((v) => v && v.toLowerCase().includes(search))) {
      return false;
    }
    if (sector && c.sector !== sector) return false;
    if (region && c.region !== region) return false;
    if (status && c.status !== status) return false;
    return true;
  });
}

function populateDynamicFilters() {
  const sectors = [...new Set(customers.map((c) => c.sector).filter(Boolean))].sort();
  const regions = [...new Set(customers.map((c) => c.region).filter(Boolean))].sort();

  const currentSector = filterSector.value;
  const currentRegion = filterRegion.value;

  filterSector.innerHTML = '<option value="">All sectors</option>';
  for (const s of sectors) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === currentSector) opt.selected = true;
    filterSector.appendChild(opt);
  }

  filterRegion.innerHTML = '<option value="">All regions</option>';
  for (const r of regions) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === currentRegion) opt.selected = true;
    filterRegion.appendChild(opt);
  }
}

function updateStats() {
  const statuses = window.__CUSTOMERS__.statuses;
  const tiles = statsContainer.querySelectorAll('.stat-tile');
  const counts = {};
  for (const s of statuses) counts[s] = 0;
  for (const c of customers) if (counts[c.status] !== undefined) counts[c.status]++;

  heroTotal.textContent = customers.length;
  statTotal.textContent = customers.length;

  tiles.forEach((tile) => {
    const sf = tile.dataset.statusFilter;
    if (sf === '') return;
    tile.querySelector('strong').textContent = counts[sf] ?? 0;
  });
}

function renderCustomers() {
  const filtered = getFilteredCustomers();
  customerList.innerHTML = '';

  filterResult.textContent = filtered.length === customers.length
    ? `${customers.length} customer${customers.length !== 1 ? 's' : ''}`
    : `${filtered.length} of ${customers.length} customer${customers.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = customers.length
      ? 'No customers match the current filters.'
      : 'No customers yet. Add the first one from the form.';
    customerList.appendChild(empty);
    return;
  }

  for (const c of filtered) {
    const row = customerRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = c.id;

    row.querySelector('.customer-name').textContent = c.name;

    const notesEl = row.querySelector('.customer-notes-text');
    if (c.notes) {
      notesEl.textContent = c.notes;
    } else {
      notesEl.remove();
    }

    const badge = row.querySelector('.customer-status-badge');
    badge.textContent = c.status;
    badge.dataset.status = c.status;

    const sectorPill = row.querySelector('.customer-sector-pill');
    if (c.sector) { sectorPill.textContent = c.sector; } else { sectorPill.remove(); }

    const regionPill = row.querySelector('.customer-region-pill');
    if (c.region) { regionPill.textContent = c.region; } else { regionPill.remove(); }

    const productPill = row.querySelector('.customer-product-pill');
    if (c.product) { productPill.textContent = c.product; } else { productPill.remove(); }

    const refPill = row.querySelector('.customer-reference-pill');
    if (c.referencePoint) { refPill.textContent = `Ref: ${c.referencePoint}`; } else { refPill.remove(); }

    customerList.appendChild(row);
  }
}

function setEditMode(customer) {
  editingId = customer.id;
  document.getElementById('customer-id').value = customer.id;
  document.getElementById('customer-name').value = customer.name;
  document.getElementById('customer-sector').value = customer.sector;
  document.getElementById('customer-region').value = customer.region;
  document.getElementById('customer-reference').value = customer.referencePoint;
  document.getElementById('customer-product').value = customer.product;
  document.getElementById('customer-status').value = customer.status;
  document.getElementById('customer-notes').value = customer.notes;

  document.getElementById('form-eyebrow').textContent = 'Edit customer';
  document.getElementById('form-heading').textContent = customer.name;
  document.getElementById('form-submit').textContent = 'Update customer';

  document.querySelector('.composer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  editingId = null;
  customerForm.reset();
  document.getElementById('customer-id').value = '';
  document.getElementById('form-eyebrow').textContent = 'New customer';
  document.getElementById('form-heading').textContent = 'Customer details';
  document.getElementById('form-submit').textContent = 'Save customer';
}

customerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('customer-name').value,
    sector: document.getElementById('customer-sector').value,
    region: document.getElementById('customer-region').value,
    referencePoint: document.getElementById('customer-reference').value,
    product: document.getElementById('customer-product').value,
    status: document.getElementById('customer-status').value,
    notes: document.getElementById('customer-notes').value
  };

  try {
    let response;
    if (editingId) {
      response = await fetch(`/api/customers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (response.status === 401) { redirectToLogin(); return; }
    if (!response.ok) {
      const body = await parseJson(response);
      throw new Error(body?.error || 'Unable to save customer.');
    }

    const { customer } = await parseJson(response);
    if (editingId) {
      customers = customers.map((c) => (c.id === editingId ? customer : c));
    } else {
      customers = [customer, ...customers];
    }

    resetForm();
    populateDynamicFilters();
    updateStats();
    renderCustomers();
  } catch (error) {
    window.alert(error.message);
  }
});

resetFormBtn.addEventListener('click', resetForm);

clearFiltersBtn.addEventListener('click', () => {
  filterSearch.value = '';
  filterSector.value = '';
  filterRegion.value = '';
  filterStatus.value = '';
  activeStatusFilter = '';
  statsContainer.querySelectorAll('.stat-tile').forEach((t) => t.classList.remove('is-active'));
  statsContainer.querySelector('[data-status-filter=""]').classList.add('is-active');
  renderCustomers();
});

statsContainer.addEventListener('click', (event) => {
  const tile = event.target.closest('.stat-tile');
  if (!tile) return;

  activeStatusFilter = tile.dataset.statusFilter;
  filterStatus.value = '';

  statsContainer.querySelectorAll('.stat-tile').forEach((t) => t.classList.remove('is-active'));
  tile.classList.add('is-active');
  renderCustomers();
});

[filterSearch, filterSector, filterRegion, filterStatus].forEach((el) => {
  el.addEventListener('input', () => {
    activeStatusFilter = '';
    statsContainer.querySelectorAll('.stat-tile').forEach((t) => t.classList.remove('is-active'));
    statsContainer.querySelector('[data-status-filter=""]').classList.add('is-active');
    renderCustomers();
  });
});

customerList.addEventListener('click', async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  const row = event.target.closest('.customer-row');
  if (!row) return;
  const id = row.dataset.id;

  if (action === 'edit-customer') {
    const customer = customers.find((c) => c.id === id);
    if (customer) setEditMode(customer);
    return;
  }

  if (action === 'delete-customer') {
    if (!window.confirm('Delete this customer?')) return;
    try {
      const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) {
        const body = await parseJson(response);
        throw new Error(body?.error || 'Unable to delete customer.');
      }
      customers = customers.filter((c) => c.id !== id);
      populateDynamicFilters();
      updateStats();
      renderCustomers();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

populateDynamicFilters();
updateStats();
renderCustomers();

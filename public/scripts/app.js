const board = document.getElementById('board');
const stats = document.getElementById('stats');
const form = document.getElementById('task-form');
const resetButton = document.getElementById('reset-form');
const template = document.getElementById('task-card-template');
const rowTemplate = document.getElementById('task-row-template');
const clearFiltersButton = document.getElementById('clear-filters');
const filterResult = document.getElementById('filter-result');
const statTiles = Array.from(stats.querySelectorAll('[data-stat-filter]'));
const viewToggle = document.getElementById('view-toggle');
const taskList = document.getElementById('task-list');
let draggedTaskId = null;
let activeStatFilter = 'total';
let viewMode = 'board';
const collapsedStatuses = Object.fromEntries(window.__TECHZICK__.statuses.map((status) => [status, true]));

const fields = {
  id: document.getElementById('task-id'),
  title: document.getElementById('title'),
  description: document.getElementById('description'),
  status: document.getElementById('status'),
  priority: document.getElementById('priority'),
  owner: document.getElementById('owner'),
  dueDate: document.getElementById('dueDate')
};

const filters = {
  search: document.getElementById('filter-search'),
  status: document.getElementById('filter-status'),
  priority: document.getElementById('filter-priority'),
  owner: document.getElementById('filter-owner'),
  due: document.getElementById('filter-due'),
  sort: document.getElementById('filter-sort')
};

let tasks = JSON.parse(board.dataset.tasks || '[]');

const priorityWeight = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStamp(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function calculateSummary(items) {
  return {
    Total: items.length,
    Planned: items.filter((task) => task.status === 'Planned').length,
    'In Progress': items.filter((task) => task.status === 'In Progress').length,
    Blocked: items.filter((task) => task.status === 'Blocked').length,
    Done: items.filter((task) => task.status === 'Done').length,
    Overdue: items.filter((task) => task.dueDate && task.status !== 'Done' && new Date(task.dueDate) < new Date()).length
  };
}

function renderStats(items) {
  const summary = calculateSummary(items);
  statTiles.forEach((card) => {
    const label = card.querySelector('span').textContent;
    card.querySelector('strong').textContent = summary[label] ?? 0;
  });
}

function syncStatTiles() {
  statTiles.forEach((tile) => {
    tile.classList.toggle('is-active', tile.dataset.statFilter === activeStatFilter);
  });
}

function applyStatFilter(filter) {
  activeStatFilter = filter;

  if (filter === 'planned') {
    filters.status.value = 'Planned';
    filters.due.value = '';
  } else if (filter === 'in-progress') {
    filters.status.value = 'In Progress';
    filters.due.value = '';
  } else if (filter === 'blocked') {
    filters.status.value = 'Blocked';
    filters.due.value = '';
  } else if (filter === 'done') {
    filters.status.value = 'Done';
    filters.due.value = '';
  } else if (filter === 'overdue') {
    filters.status.value = '';
    filters.due.value = 'overdue';
  } else {
    filters.status.value = '';
    filters.due.value = '';
    activeStatFilter = 'total';
  }
}

function toDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function matchesDueFilter(task, dueFilter) {
  if (!dueFilter) return true;
  if (!task.dueDate) {
    return dueFilter === 'none';
  }

  const today = toDateKey(new Date());
  const dueDate = toDateKey(task.dueDate);

  if (dueFilter === 'today') return dueDate === today;
  if (dueFilter === 'overdue') return dueDate < today && task.status !== 'Done';
  if (dueFilter === 'upcoming') return dueDate > today;
  if (dueFilter === 'none') return false;
  return true;
}

function sortTasks(items, sortValue) {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (sortValue === 'due-asc') {
      const leftDue = left.dueDate || '9999-12-31';
      const rightDue = right.dueDate || '9999-12-31';
      return leftDue.localeCompare(rightDue);
    }

    if (sortValue === 'priority-desc') {
      return (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
    }

    if (sortValue === 'title-asc') {
      return left.title.localeCompare(right.title);
    }

    return new Date(right.updatedAt) - new Date(left.updatedAt);
  });
  return sorted;
}

function getFilteredTasks() {
  const search = filters.search.value.trim().toLowerCase();
  const status = filters.status.value;
  const priority = filters.priority.value;
  const owner = filters.owner.value;
  const due = filters.due.value;
  const sort = filters.sort.value;

  const filtered = tasks.filter((task) => {
    const haystack = `${task.title} ${task.description} ${task.owner}`.toLowerCase();
    const ownerValue = (task.owner || 'Unassigned').trim();

    return (!search || haystack.includes(search)) &&
      (!status || task.status === status) &&
      (!priority || task.priority === priority) &&
      (!owner || ownerValue === owner) &&
      matchesDueFilter(task, due);
  });

  return sortTasks(filtered, sort);
}

function renderFilterResult(items) {
  const total = tasks.length;
  const filtered = items.length;
  filterResult.textContent = filtered === total
    ? `Showing all ${total} tasks`
    : `Showing ${filtered} of ${total} tasks`;
}

function refreshOwnerOptions() {
  const selected = filters.owner.value;
  const owners = [...new Set(tasks.map((task) => (task.owner || 'Unassigned').trim()))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  filters.owner.innerHTML = '<option value="">All owners</option>';
  for (const owner of owners) {
    const option = document.createElement('option');
    option.value = owner;
    option.textContent = owner;
    filters.owner.appendChild(option);
  }

  if (owners.includes(selected)) {
    filters.owner.value = selected;
  }
}

function renderBoard(items) {
  board.innerHTML = '';
  for (const status of window.__TECHZICK__.statuses) {
    const isCollapsed = collapsedStatuses[status];
    const column = document.createElement('section');
    column.className = `board-column${isCollapsed ? ' is-collapsed' : ''}`;
    column.dataset.status = status;
    column.innerHTML = `
      <button type="button" class="column-toggle" data-action="toggle-column" data-status="${status}" aria-expanded="${String(!isCollapsed)}">
        <span class="column-title">${status}</span>
        <span class="column-meta">
          <strong>${items.filter((task) => task.status === status).length}</strong>
          <span class="column-chevron">${isCollapsed ? '+' : '−'}</span>
        </span>
      </button>
      <div class="column-list" data-status="${status}"></div>
    `;

    const list = column.querySelector('.column-list');
    const columnTasks = items.filter((task) => task.status === status);
    if (!columnTasks.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No tasks in this lane.';
      list.appendChild(empty);
    }

    for (const task of columnTasks) {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.id = task.id;
      node.setAttribute('draggable', 'true');
      node.querySelector('.priority-pill').textContent = task.priority;
      node.querySelector('h3').textContent = task.title;
      node.querySelector('.task-desc').textContent = task.description || 'No additional detail provided.';
      node.querySelector('.task-owner').textContent = task.owner || 'Unassigned';
      node.querySelector('.task-due').textContent = formatDate(task.dueDate);
      node.querySelector('.task-updated').textContent = formatStamp(task.updatedAt);
      list.appendChild(node);
    }

    board.appendChild(column);
  }
}

function renderList(items) {
  taskList.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks match the current filters.';
    taskList.appendChild(empty);
    return;
  }

  for (const task of items) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = task.id;
    row.querySelector('h3').textContent = task.title;
    row.querySelector('.task-desc').textContent = task.description || 'No additional detail provided.';
    row.querySelector('.priority-pill').textContent = task.priority;
    row.querySelector('.task-status').textContent = task.status;
    row.querySelector('.task-owner').textContent = task.owner || 'Unassigned';
    row.querySelector('.task-due').textContent = formatDate(task.dueDate);
    taskList.appendChild(row);
  }
}

function syncViewMode() {
  const isBoard = viewMode === 'board';
  board.classList.toggle('hidden', !isBoard);
  taskList.classList.toggle('hidden', isBoard);
  board.setAttribute('aria-hidden', String(!isBoard));
  taskList.setAttribute('aria-hidden', String(isBoard));
  viewToggle.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === viewMode);
  });
}

function render() {
  refreshOwnerOptions();
  const filteredTasks = getFilteredTasks();
  renderStats(filteredTasks);
  syncStatTiles();
  renderFilterResult(filteredTasks);
  renderBoard(filteredTasks);
  renderList(filteredTasks);
  syncViewMode();
}

function resetForm() {
  form.reset();
  fields.id.value = '';
  fields.status.value = 'Planned';
  fields.priority.value = 'Medium';
}

function populateForm(task) {
  fields.id.value = task.id;
  fields.title.value = task.title;
  fields.description.value = task.description || '';
  fields.status.value = task.status;
  fields.priority.value = task.priority;
  fields.owner.value = task.owner || '';
  fields.dueDate.value = task.dueDate || '';
  fields.title.focus();
}

async function handleTaskAction(taskId, action) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (action === 'edit') {
    populateForm(task);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Delete task "${task.title}"?`);
    if (!confirmed) return;

    try {
      await removeTask(task.id);
      render();
    } catch (error) {
      window.alert(error.message);
    }
  }
}

async function saveTask(payload, id) {
  const response = await fetch(id ? `/api/tasks/${id}` : '/api/tasks', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || 'Unable to save task.');
  }

  const { task } = await response.json();
  if (id) {
    tasks = tasks.map((item) => (item.id === id ? task : item));
  } else {
    tasks = [task, ...tasks];
  }
}

async function removeTask(id) {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || 'Unable to delete task.');
  }
  tasks = tasks.filter((task) => task.id !== id);
}

async function moveTaskToStatus(id, status) {
  const task = tasks.find((item) => item.id === id);
  if (!task || task.status === status) {
    return;
  }

  await saveTask(
    {
      title: task.title,
      description: task.description,
      status,
      priority: task.priority,
      owner: task.owner,
      dueDate: task.dueDate
    },
    id
  );

  if (fields.id.value === id) {
    fields.status.value = status;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    title: fields.title.value,
    description: fields.description.value,
    status: fields.status.value,
    priority: fields.priority.value,
    owner: fields.owner.value,
    dueDate: fields.dueDate.value
  };

  try {
    await saveTask(payload, fields.id.value || undefined);
    resetForm();
    render();
  } catch (error) {
    window.alert(error.message);
  }
});

resetButton.addEventListener('click', resetForm);

Object.values(filters).forEach((control) => {
  control.addEventListener('input', () => {
    activeStatFilter = 'total';
    syncStatTiles();
    render();
  });
  control.addEventListener('change', () => {
    activeStatFilter = 'total';
    syncStatTiles();
    render();
  });
});

clearFiltersButton.addEventListener('click', () => {
  filters.search.value = '';
  filters.status.value = '';
  filters.priority.value = '';
  filters.owner.value = '';
  filters.due.value = '';
  filters.sort.value = 'updated-desc';
  activeStatFilter = 'total';
  render();
});

stats.addEventListener('click', (event) => {
  const tile = event.target.closest('[data-stat-filter]');
  if (!tile) return;

  applyStatFilter(tile.dataset.statFilter);
  render();
});

viewToggle.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  viewMode = button.dataset.view;
  syncViewMode();
});

board.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');
  const action = actionTarget?.dataset.action;
  if (!action) return;

  if (action === 'toggle-column') {
    const status = actionTarget.dataset.status;
    collapsedStatuses[status] = !collapsedStatuses[status];
    render();
    return;
  }

  const card = event.target.closest('.task-card');
  if (!card) return;
  await handleTaskAction(card.dataset.id, action);
});

taskList.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');
  const action = actionTarget?.dataset.action;
  if (!action) return;

  const row = event.target.closest('.task-row');
  if (!row) return;

  await handleTaskAction(row.dataset.id, action);
});

board.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.task-card');
  if (!card) return;

  draggedTaskId = card.dataset.id;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedTaskId);
});

board.addEventListener('dragend', (event) => {
  const card = event.target.closest('.task-card');
  if (card) {
    card.classList.remove('dragging');
  }

  draggedTaskId = null;
  board.querySelectorAll('.column-list.drop-target').forEach((list) => list.classList.remove('drop-target'));
});

board.addEventListener('dragover', (event) => {
  const list = event.target.closest('.column-list');
  if (!list || !draggedTaskId) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
});

board.addEventListener('dragenter', (event) => {
  const list = event.target.closest('.column-list');
  if (!list || !draggedTaskId) return;
  list.classList.add('drop-target');
});

board.addEventListener('dragleave', (event) => {
  const list = event.target.closest('.column-list');
  if (!list || list.contains(event.relatedTarget)) return;
  list.classList.remove('drop-target');
});

board.addEventListener('drop', async (event) => {
  const list = event.target.closest('.column-list');
  if (!list || !draggedTaskId) return;

  event.preventDefault();
  list.classList.remove('drop-target');

  try {
    await moveTaskToStatus(draggedTaskId, list.dataset.status);
    render();
  } catch (error) {
    window.alert(error.message);
  }
});

render();

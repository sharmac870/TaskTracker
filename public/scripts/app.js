const board = document.getElementById('board');
const stats = document.getElementById('stats');
const form = document.getElementById('task-form');
const resetButton = document.getElementById('reset-form');
const template = document.getElementById('task-card-template');
const clearFiltersButton = document.getElementById('clear-filters');
const filterResult = document.getElementById('filter-result');

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
  Array.from(stats.children).forEach((card) => {
    const label = card.querySelector('span').textContent;
    card.querySelector('strong').textContent = summary[label] ?? 0;
  });
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
    const column = document.createElement('section');
    column.className = 'board-column';
    column.innerHTML = `
      <header>
        <span>${status}</span>
        <strong>${items.filter((task) => task.status === status).length}</strong>
      </header>
      <div class="column-list"></div>
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

function render() {
  refreshOwnerOptions();
  const filteredTasks = getFilteredTasks();
  renderStats(filteredTasks);
  renderFilterResult(filteredTasks);
  renderBoard(filteredTasks);
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
  control.addEventListener('input', render);
  control.addEventListener('change', render);
});

clearFiltersButton.addEventListener('click', () => {
  filters.search.value = '';
  filters.status.value = '';
  filters.priority.value = '';
  filters.owner.value = '';
  filters.due.value = '';
  filters.sort.value = 'updated-desc';
  render();
});

board.addEventListener('click', async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.target.closest('.task-card');
  const task = tasks.find((item) => item.id === card.dataset.id);
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
});

render();

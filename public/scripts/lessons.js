const lessonForm = document.getElementById('lesson-form');
const lessonsList = document.getElementById('lessons-list');
const lessonTemplate = document.getElementById('lesson-card-template');
const deleteSelectedButton = document.getElementById('delete-selected-lessons');

let lessons = JSON.parse(lessonsList.dataset.lessons || '[]');

async function parseJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function redirectToLogin() {
  const nextPath = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${nextPath}`);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderLessons() {
  lessonsList.innerHTML = '';

  if (!lessons.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No lessons captured yet. Add the first one from the form.';
    lessonsList.appendChild(empty);
    return;
  }

  for (const lesson of lessons) {
    const card = lessonTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = lesson.id;
    card.querySelector('.lesson-checkbox').value = lesson.id;
    card.querySelector('.lesson-date').textContent = formatDate(lesson.createdAt);
    card.querySelector('.lesson-title').textContent = lesson.title;
    card.querySelector('.lesson-summary').textContent = lesson.summary;
    lessonsList.appendChild(card);
  }
}

lessonForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    title: document.getElementById('lesson-title').value,
    summary: document.getElementById('lesson-summary').value
  };

  try {
    const response = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      const body = await parseJson(response);
      throw new Error(body?.error || 'Unable to save lesson.');
    }

    const { lesson } = await parseJson(response);
    lessons = [lesson, ...lessons];
    lessonForm.reset();
    renderLessons();
  } catch (error) {
    window.alert(error.message);
  }
});

deleteSelectedButton.addEventListener('click', async () => {
  const ids = Array.from(document.querySelectorAll('.lesson-checkbox:checked')).map((checkbox) => checkbox.value);
  if (!ids.length) {
    window.alert('Select at least one lesson.');
    return;
  }

  try {
    const response = await fetch('/api/lessons/delete-many', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      const body = await parseJson(response);
      throw new Error(body?.error || 'Unable to delete lessons.');
    }

    lessons = lessons.filter((lesson) => !ids.includes(lesson.id));
    renderLessons();
  } catch (error) {
    window.alert(error.message);
  }
});

lessonsList.addEventListener('click', async (event) => {
  if (event.target.dataset.action !== 'delete-lesson') {
    return;
  }

  const card = event.target.closest('.lesson-card');
  if (!card) {
    return;
  }

  try {
    const response = await fetch(`/api/lessons/${card.dataset.id}`, { method: 'DELETE' });
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) {
      const body = await parseJson(response);
      throw new Error(body?.error || 'Unable to delete lesson.');
    }

    lessons = lessons.filter((lesson) => lesson.id !== card.dataset.id);
    renderLessons();
  } catch (error) {
    window.alert(error.message);
  }
});

renderLessons();

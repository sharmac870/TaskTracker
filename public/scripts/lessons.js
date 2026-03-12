const lessonForm = document.getElementById('lesson-form');
const lessonsList = document.getElementById('lessons-list');
const lessonTemplate = document.getElementById('lesson-card-template');

let lessons = JSON.parse(lessonsList.dataset.lessons || '[]');

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
    card.querySelector('.lesson-stage').textContent = lesson.stage || 'General';
    card.querySelector('.lesson-date').textContent = formatDate(lesson.createdAt);
    card.querySelector('.lesson-title').textContent = lesson.title;
    card.querySelector('.lesson-summary').textContent = lesson.summary;
    card.querySelector('.lesson-impact').textContent = lesson.impact || 'No downstream action recorded yet.';
    lessonsList.appendChild(card);
  }
}

lessonForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    title: document.getElementById('lesson-title').value,
    stage: document.getElementById('lesson-stage').value,
    summary: document.getElementById('lesson-summary').value,
    impact: document.getElementById('lesson-impact').value
  };

  try {
    const response = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || 'Unable to save lesson.');
    }

    const { lesson } = await response.json();
    lessons = [lesson, ...lessons];
    lessonForm.reset();
    renderLessons();
  } catch (error) {
    window.alert(error.message);
  }
});

renderLessons();

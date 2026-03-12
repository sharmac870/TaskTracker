require('dotenv').config();

const express = require('express');
const path = require('path');
const { createStorage, summarize, STATUSES, PRIORITIES } = require('./storage');
const { createLessonStorage } = require('./lessons');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const storage = createStorage();
const lessonStorage = createLessonStorage();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', async (req, res, next) => {
  try {
    const tasks = await storage.listTasks();
    res.render('index', {
      appName: process.env.APP_NAME || 'Techzick Planner',
      tasks,
      summary: summarize(tasks),
      lessonCount: (await lessonStorage.listLessons()).length,
      statuses: STATUSES,
      priorities: PRIORITIES
    });
  } catch (error) {
    next(error);
  }
});

app.get('/lessons', async (req, res, next) => {
  try {
    const lessons = await lessonStorage.listLessons();
    res.render('lessons', {
      appName: process.env.APP_NAME || 'Techzick Planner',
      lessons
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks', async (req, res, next) => {
  try {
    const tasks = await storage.listTasks();
    res.json({ tasks, summary: summarize(tasks) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const task = await storage.createTask(req.body);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await storage.updateTask(req.params.id, req.body);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const deleted = await storage.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/lessons', async (req, res, next) => {
  try {
    const lessons = await lessonStorage.listLessons();
    res.json({ lessons });
  } catch (error) {
    next(error);
  }
});

app.post('/api/lessons', async (req, res, next) => {
  try {
    const lesson = await lessonStorage.createLesson(req.body);
    res.status(201).json({ lesson });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/lessons/:id', async (req, res, next) => {
  try {
    const deleted = await lessonStorage.deleteLesson(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/lessons/delete-many', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ error: 'Select at least one lesson.' });
    }
    const deletedCount = await lessonStorage.deleteLessons(ids);
    res.json({ deletedCount });
  } catch (error) {
    next(error);
  }
});

app.get('/healthz', async (req, res) => {
  res.json({ ok: true, app: 'techzick-planner' });
});

app.use((error, req, res, next) => {
  console.error(error);
  const status = ['Task title is required.', 'Lesson title is required.', 'Lesson summary is required.', 'Select at least one lesson.'].includes(error.message) ? 400 : 500;
  res.status(status).json({ error: error.message || 'Unexpected server error.' });
});

const server = app.listen(port, host, () => {
  const localHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`Techzick Planner listening at http://${localHost}:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Change PORT in .env or stop the process using it.`);
    process.exit(1);
  }

  console.error('Server failed to start:', error);
  process.exit(1);
});

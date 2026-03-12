require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const path = require('path');
const { createStorage, summarize, STATUSES, PRIORITIES } = require('./storage');
const { createLessonStorage } = require('./lessons');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const storage = createStorage();
const lessonStorage = createLessonStorage();
const authCookieName = 'kinetriq_session';
const authUsername = 'Kinetriq';
const authPassword = '9711210569';
const sessionSecret = process.env.SESSION_SECRET || 'kinetriq-tasktracker-session-secret';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((allCookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex < 0) {
        return allCookies;
      }

      const key = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      allCookies[key] = decodeURIComponent(value);
      return allCookies;
    }, {});
}

function createSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      issuedAt: Date.now()
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payload, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const providedBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session?.username === authUsername ? session : null;
  } catch {
    return null;
  }
}

function setSessionCookie(res, username) {
  const cookieValue = createSessionToken(username);
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${authCookieName}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function attachSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const session = readSession(cookies[authCookieName]);
  req.user = session ? { username: session.username } : null;
  res.locals.currentUser = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const redirectTarget = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${redirectTarget}`);
}

app.use(attachSession);

app.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }

  res.render('login', {
    appName: process.env.APP_NAME || 'Kinetriq IDC',
    error: req.query.error === '1' ? 'Invalid username or password.' : '',
    nextPath: typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/'
  });
});

app.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const nextPath = typeof req.body.next === 'string' && req.body.next.startsWith('/') ? req.body.next : '/';

  if (username !== authUsername || password !== authPassword) {
    return res.status(401).render('login', {
      appName: process.env.APP_NAME || 'Kinetriq IDC',
      error: 'Invalid username or password.',
      nextPath
    });
  }

  setSessionCookie(res, username);
  return res.redirect(nextPath);
});

app.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.redirect('/login');
});

app.get('/', requireAuth, async (req, res, next) => {
  try {
    const tasks = await storage.listTasks();
    res.render('index', {
      appName: process.env.APP_NAME || 'Kinetriq IDC',
      tasks,
      summary: summarize(tasks),
      lessonCount: (await lessonStorage.listLessons()).length,
      currentUser: req.user,
      statuses: STATUSES,
      priorities: PRIORITIES
    });
  } catch (error) {
    next(error);
  }
});

app.get('/lessons', requireAuth, async (req, res, next) => {
  try {
    const lessons = await lessonStorage.listLessons();
    res.render('lessons', {
      appName: process.env.APP_NAME || 'Kinetriq IDC',
      lessons,
      currentUser: req.user
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks', requireAuth, async (req, res, next) => {
  try {
    const tasks = await storage.listTasks();
    res.json({ tasks, summary: summarize(tasks) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', requireAuth, async (req, res, next) => {
  try {
    const task = await storage.createTask(req.body);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', requireAuth, async (req, res, next) => {
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

app.delete('/api/tasks/:id', requireAuth, async (req, res, next) => {
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

app.get('/api/lessons', requireAuth, async (req, res, next) => {
  try {
    const lessons = await lessonStorage.listLessons();
    res.json({ lessons });
  } catch (error) {
    next(error);
  }
});

app.post('/api/lessons', requireAuth, async (req, res, next) => {
  try {
    const lesson = await lessonStorage.createLesson(req.body);
    res.status(201).json({ lesson });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/lessons/:id', requireAuth, async (req, res, next) => {
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

app.post('/api/lessons/delete-many', requireAuth, async (req, res, next) => {
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
  res.json({ ok: true, app: 'kinetriq-idc' });
});

app.use((error, req, res, next) => {
  console.error(error);
  const status = ['Task title is required.', 'Lesson title is required.', 'Lesson summary is required.', 'Select at least one lesson.'].includes(error.message) ? 400 : 500;
  res.status(status).json({ error: error.message || 'Unexpected server error.' });
});

const server = app.listen(port, host, () => {
  const localHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`Kinetriq IDC listening at http://${localHost}:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Change PORT in .env or stop the process using it.`);
    process.exit(1);
  }

  console.error('Server failed to start:', error);
  process.exit(1);
});

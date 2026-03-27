const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..');

function resolveLessonsFile() {
  if (process.env.LESSONS_FILE) {
    return path.resolve(PROJECT_ROOT, process.env.LESSONS_FILE);
  }

  if (process.env.DATA_FILE) {
    const dataDir = path.dirname(path.resolve(PROJECT_ROOT, process.env.DATA_FILE));
    return path.join(dataDir, 'lessons.json');
  }

  return path.join(PROJECT_ROOT, 'data', 'lessons.json');
}

class LessonStorage {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  async ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]', 'utf8');
    }
  }

  async readLessons() {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch {
      console.error(`[storage] lessons.json is corrupt — resetting to empty. File: ${this.filePath}`);
      await fs.writeFile(this.filePath, '[]', 'utf8');
      return [];
    }
  }

  async writeLessons(lessons) {
    await this.ensureFile();
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(lessons, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }

  async listLessons() {
    const lessons = await this.readLessons();
    return lessons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createLesson(input) {
    const lesson = normalizeLesson(input);
    validateLesson(lesson);
    const lessons = await this.readLessons();
    lessons.push(lesson);
    await this.writeLessons(lessons);
    return lesson;
  }

  async deleteLesson(id) {
    const lessons = await this.readLessons();
    const nextLessons = lessons.filter((lesson) => lesson.id !== id);
    const deleted = nextLessons.length !== lessons.length;
    if (deleted) {
      await this.writeLessons(nextLessons);
    }
    return deleted;
  }

  async deleteLessons(ids) {
    const idSet = new Set(ids);
    const lessons = await this.readLessons();
    const nextLessons = lessons.filter((lesson) => !idSet.has(lesson.id));
    const deletedCount = lessons.length - nextLessons.length;
    if (deletedCount > 0) {
      await this.writeLessons(nextLessons);
    }
    return deletedCount;
  }
}

function normalizeLesson(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    title: String(input.title || '').trim(),
    summary: String(input.summary || '').trim(),
    createdAt: now
  };
}

function validateLesson(lesson) {
  if (!lesson.title) {
    throw new Error('Lesson title is required.');
  }

  if (!lesson.summary) {
    throw new Error('Lesson summary is required.');
  }
}

function createLessonStorage() {
  return new LessonStorage(resolveLessonsFile());
}

module.exports = {
  createLessonStorage
};

const fs = require('fs/promises');
const path = require('path');
const sql = require('mssql');
const { randomUUID } = require('crypto');

const STATUSES = ['Planned', 'In Progress', 'Blocked', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function normalizeTask(input, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || randomUUID(),
    title: String(input.title || existing.title || '').trim(),
    description: String(input.description || existing.description || '').trim(),
    comment: String(input.comment || existing.comment || '').trim(),
    status: STATUSES.includes(input.status) ? input.status : existing.status || 'Planned',
    priority: PRIORITIES.includes(input.priority) ? input.priority : existing.priority || 'Medium',
    owner: String(input.owner || existing.owner || '').trim(),
    dueDate: input.dueDate || existing.dueDate || '',
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function validateTask(task) {
  if (!task.title) {
    throw new Error('Task title is required.');
  }
}

class FileStorage {
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

  async readTasks() {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw);
  }

  async writeTasks(tasks) {
    await this.ensureFile();
    await fs.writeFile(this.filePath, JSON.stringify(tasks, null, 2), 'utf8');
  }

  async listTasks() {
    const tasks = await this.readTasks();
    return tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async createTask(input) {
    const task = normalizeTask(input);
    validateTask(task);
    const tasks = await this.readTasks();
    tasks.push(task);
    await this.writeTasks(tasks);
    return task;
  }

  async updateTask(id, input) {
    const tasks = await this.readTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const updated = normalizeTask(input, tasks[index]);
    validateTask(updated);
    tasks[index] = updated;
    await this.writeTasks(tasks);
    return updated;
  }

  async deleteTask(id) {
    const tasks = await this.readTasks();
    const nextTasks = tasks.filter((task) => task.id !== id);
    const deleted = nextTasks.length !== tasks.length;
    if (deleted) {
      await this.writeTasks(nextTasks);
    }
    return deleted;
  }
}

class SqlStorage {
  constructor(config) {
    this.config = config;
    this.poolPromise = null;
  }

  async pool() {
    if (!this.poolPromise) {
      this.poolPromise = sql.connect(this.config);
    }
    return this.poolPromise;
  }

  async init() {
    const pool = await this.pool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tasks' and xtype='U')
      CREATE TABLE Tasks (
        id NVARCHAR(64) PRIMARY KEY,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        comment NVARCHAR(MAX) NULL,
        status NVARCHAR(40) NOT NULL,
        priority NVARCHAR(40) NOT NULL,
        owner NVARCHAR(120) NULL,
        dueDate NVARCHAR(40) NULL,
        createdAt NVARCHAR(40) NOT NULL,
        updatedAt NVARCHAR(40) NOT NULL
      )
    `);

    await pool.request().query(`
      IF COL_LENGTH('Tasks', 'comment') IS NULL
      ALTER TABLE Tasks ADD comment NVARCHAR(MAX) NULL
    `);
  }

  mapRecord(record) {
    return {
      id: record.id,
      title: record.title,
      description: record.description || '',
      comment: record.comment || '',
      status: record.status,
      priority: record.priority,
      owner: record.owner || '',
      dueDate: record.dueDate || '',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async listTasks() {
    await this.init();
    const pool = await this.pool();
    const result = await pool.request().query('SELECT * FROM Tasks ORDER BY updatedAt DESC');
    return result.recordset.map((record) => this.mapRecord(record));
  }

  async createTask(input) {
    await this.init();
    const task = normalizeTask(input);
    validateTask(task);
    const pool = await this.pool();
    await pool.request()
      .input('id', sql.NVarChar(64), task.id)
      .input('title', sql.NVarChar(200), task.title)
      .input('description', sql.NVarChar(sql.MAX), task.description)
      .input('comment', sql.NVarChar(sql.MAX), task.comment)
      .input('status', sql.NVarChar(40), task.status)
      .input('priority', sql.NVarChar(40), task.priority)
      .input('owner', sql.NVarChar(120), task.owner)
      .input('dueDate', sql.NVarChar(40), task.dueDate)
      .input('createdAt', sql.NVarChar(40), task.createdAt)
      .input('updatedAt', sql.NVarChar(40), task.updatedAt)
      .query(`
        INSERT INTO Tasks (id, title, description, comment, status, priority, owner, dueDate, createdAt, updatedAt)
        VALUES (@id, @title, @description, @comment, @status, @priority, @owner, @dueDate, @createdAt, @updatedAt)
      `);
    return task;
  }

  async updateTask(id, input) {
    await this.init();
    const pool = await this.pool();
    const existingResult = await pool.request().input('id', sql.NVarChar(64), id).query('SELECT * FROM Tasks WHERE id = @id');
    if (!existingResult.recordset.length) return null;
    const existing = this.mapRecord(existingResult.recordset[0]);
    const task = normalizeTask(input, existing);
    validateTask(task);
    await pool.request()
      .input('id', sql.NVarChar(64), id)
      .input('title', sql.NVarChar(200), task.title)
      .input('description', sql.NVarChar(sql.MAX), task.description)
      .input('comment', sql.NVarChar(sql.MAX), task.comment)
      .input('status', sql.NVarChar(40), task.status)
      .input('priority', sql.NVarChar(40), task.priority)
      .input('owner', sql.NVarChar(120), task.owner)
      .input('dueDate', sql.NVarChar(40), task.dueDate)
      .input('updatedAt', sql.NVarChar(40), task.updatedAt)
      .query(`
        UPDATE Tasks
        SET title = @title,
            description = @description,
            comment = @comment,
            status = @status,
            priority = @priority,
            owner = @owner,
            dueDate = @dueDate,
            updatedAt = @updatedAt
        WHERE id = @id
      `);
    return task;
  }

  async deleteTask(id) {
    await this.init();
    const pool = await this.pool();
    const result = await pool.request().input('id', sql.NVarChar(64), id).query('DELETE FROM Tasks WHERE id = @id');
    return result.rowsAffected[0] > 0;
  }
}

function createStorage() {
  const provider = process.env.STORAGE_PROVIDER || (process.env.DB_SERVER ? 'mssql' : 'file');
  if (provider === 'mssql') {
    return new SqlStorage({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME || 'techzickplanner',
      options: {
        encrypt: String(process.env.DB_ENCRYPT || 'true') === 'true',
        trustServerCertificate: false
      }
    });
  }
  return new FileStorage(process.env.DATA_FILE || './data/tasks.json');
}

function summarize(tasks) {
  return {
    total: tasks.length,
    planned: tasks.filter((task) => task.status === 'Planned').length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    done: tasks.filter((task) => task.status === 'Done').length,
    overdue: tasks.filter((task) => task.dueDate && task.status !== 'Done' && new Date(task.dueDate) < new Date()).length
  };
}

module.exports = {
  STATUSES,
  PRIORITIES,
  createStorage,
  summarize
};

const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..');

const CUSTOMER_STATUSES = ['Prospect', 'In Discussion', 'Pilot', 'Onboarded', 'Churned'];

function resolveCustomersFile() {
  if (process.env.CUSTOMERS_FILE) {
    return path.resolve(PROJECT_ROOT, process.env.CUSTOMERS_FILE);
  }

  if (process.env.DATA_FILE) {
    const dataDir = path.dirname(path.resolve(PROJECT_ROOT, process.env.DATA_FILE));
    return path.join(dataDir, 'customers.json');
  }

  return path.join(PROJECT_ROOT, 'data', 'customers.json');
}

class CustomerStorage {
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

  async readCustomers() {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch {
      console.error(`[storage] customers.json is corrupt — resetting to empty. File: ${this.filePath}`);
      await fs.writeFile(this.filePath, '[]', 'utf8');
      return [];
    }
  }

  async writeCustomers(customers) {
    await this.ensureFile();
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(customers, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }

  async listCustomers() {
    const customers = await this.readCustomers();
    return customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createCustomer(input) {
    const customer = normalizeCustomer(input);
    validateCustomer(customer);
    const customers = await this.readCustomers();
    customers.push(customer);
    await this.writeCustomers(customers);
    return customer;
  }

  async updateCustomer(id, input) {
    const customers = await this.readCustomers();
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const updated = normalizeCustomer({ ...customers[idx], ...input, id, createdAt: customers[idx].createdAt });
    validateCustomer(updated);
    customers[idx] = updated;
    await this.writeCustomers(customers);
    return updated;
  }

  async deleteCustomer(id) {
    const customers = await this.readCustomers();
    const next = customers.filter((c) => c.id !== id);
    const deleted = next.length !== customers.length;
    if (deleted) await this.writeCustomers(next);
    return deleted;
  }
}

function normalizeCustomer(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    name: String(input.name || '').trim(),
    sector: String(input.sector || '').trim(),
    region: String(input.region || '').trim(),
    referencePoint: String(input.referencePoint || '').trim(),
    product: String(input.product || '').trim(),
    status: CUSTOMER_STATUSES.includes(input.status) ? input.status : 'Prospect',
    notes: String(input.notes || '').trim(),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

function validateCustomer(customer) {
  if (!customer.name) {
    throw new Error('Customer name is required.');
  }
}

function createCustomerStorage() {
  return new CustomerStorage(resolveCustomersFile());
}

module.exports = { createCustomerStorage, CUSTOMER_STATUSES };

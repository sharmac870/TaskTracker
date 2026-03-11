# Techzick Planner

Lightweight task tracking for startup teams. The app provides a single web workspace to capture, update, and review tasks with persistent storage.

## Features

- Branded `Techzick Planner` dashboard
- Create, edit, and delete tasks
- Status lanes for `Planned`, `In Progress`, `Blocked`, and `Done`
- Priority, owner, due date, and update timestamp tracking
- Persistent local storage with `data/tasks.json`
- Azure SQL support for deployed environments

## Local Run

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`
3. Start the app:
   `npm run dev`
4. Open `http://127.0.0.1:6000`

## Azure Shape

- Azure App Service for hosting
- Azure SQL Database for persistent cloud data
- Azure Key Vault for SQL secrets
- Application Insights and Log Analytics for monitoring

## Key Environment Variables

- `STORAGE_PROVIDER=file` for local persistent file storage
- `HOST=0.0.0.0` for broad local binding compatibility
- `PORT=6000` for the default local port
- `STORAGE_PROVIDER=mssql` for Azure SQL
- `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` for SQL connectivity
- `SQL_ADMIN_LOGIN`, `SQL_ADMIN_PASSWORD` for infrastructure deployment parameters

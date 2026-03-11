# Azure Deployment Plan

> **Status:** Ready for Validation

Generated: 2026-03-11

---

## 1. Project Overview

**Goal:** Build `Techzick Planner`, a lightweight Microsoft Planner / Microsoft Project style task-tracking web application where teams can create, update, organize, and persist tasks in one place.

**Path:** New Project

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Development |
| Scale | Small |
| Budget | Balanced |
| Compliance / Data Residency | No special compliance stated |
| **Subscription** | `8117e214-4622-48b8-85b9-a6feb362c220` |
| **Location** | `Central India` |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| techzick-planner-web | Full-stack web app | Node.js + Express + EJS | `/` |
| persistence-store | Database | Azure SQL Database with local file-store fallback | Azure managed service / `data/tasks.json` |

Notes:
- Workspace started empty.
- Implementation is being generated as a single deployable web application.

---

## 4. Recipe Selection

**Selected:** AZD

**Rationale:** For a greenfield Azure-hosted internal tool, AZD gives the fastest repeatable workflow for infrastructure, application config, and later validation/deployment.

---

## 5. Architecture

**Stack:** App Service

### Proposed Solution Shape

- Frontend and backend delivered as a single web application for low operational overhead.
- Persistent storage backed by Azure SQL Database in Azure.
- Local development fallback uses a JSON file store so data stays persisted without requiring an immediate SQL setup.
- Product branding aligned to `Techzick Planner`.

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| techzick-planner-web | Azure App Service | B1 |
| app-service-plan | Azure App Service Plan | B1 |
| persistence-store | Azure SQL Database | Basic |
| secrets-store | Azure Key Vault | Standard |
| telemetry | Application Insights | Basic |
| logs | Log Analytics Workspace | PerGB2018 |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring and diagnostics |
| Key Vault | Secrets management |
| Managed Identity | Secretless service-to-service auth |

### Initial Product Scope

- Dashboard with task summary
- Create, edit, delete, and complete tasks
- Status workflow: `Planned`, `In Progress`, `Blocked`, `Done`
- Priority and due date tracking
- Task owner field
- Persistent data storage
- Branded UI for `Techzick Planner`

---

## 6. Execution Checklist

### Phase 1: Planning
- [x] Analyze workspace
- [x] Gather requirements from the user prompt
- [x] Confirm classification, scale, budget, compliance assumptions
- [x] Confirm subscription and location with user
- [x] Scan codebase
- [x] Select recipe
- [x] Plan architecture
- [x] **User approved this plan**

### Phase 2: Execution
- [x] Research components (frontend, backend, persistence, Azure references)
- [x] Generate infrastructure files following App Service and Azure SQL guidance
- [x] Generate application source code for `Techzick Planner`
- [x] Generate application configuration
- [x] Generate deployment artifacts
- [x] Update plan status to `Ready for Validation`

### Phase 3: Validation
- [ ] Invoke azure-validate skill
- [ ] All validation checks pass
- [ ] Update plan status to `Validated`
- [ ] Record validation proof below

### Phase 4: Deployment
- [ ] Invoke azure-deploy skill
- [ ] Deployment successful
- [ ] Update plan status to `Deployed`

---

## 7. Validation Proof

> **Required**: This section will be populated during the azure-validate step.

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| Pending | Pending | Pending | Pending |

**Validated by:** Pending
**Validation timestamp:** Pending

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/plan.md` | Planning source of truth | ✅ |
| `azure.yaml` | AZD configuration | ✅ |
| `infra/main.bicep` | Azure infrastructure | ✅ |
| `package.json` | App dependencies and scripts | ✅ |
| `src/*` | Techzick Planner application code | ✅ |
| `.env.example` | Local configuration template | ✅ |

---

## 9. Next Steps

> Current: Local validation

1. Run install and basic local validation.
2. Update plan status to `Ready for Validation`.
3. Invoke azure-validate before any deployment.

# 🎫 HelpDesk Pro — Support Ticket System

A full-stack helpdesk application with **complete observability**: metrics (Prometheus), logs (Loki), and traces (Tempo), all visualized in Grafana.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Django 4.2 + Django REST Framework |
| **Frontend** | Next.js 14 (TypeScript) |
| **Database** | PostgreSQL 15 |
| **Metrics** | Prometheus + prometheus_client |
| **Logs** | Loki + python-json-logger |
| **Traces** | OpenTelemetry → OTel Collector → Tempo |
| **Dashboards** | Grafana (4 pre-provisioned dashboards) |
| **Load Testing** | k6 |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) k6 for load testing

### 1. Clone & Configure
```bash
cp .env.example .env
# Edit .env if needed (defaults work out of the box)
```

### 2. Start All Services
```bash
docker-compose up --build
```

This starts **8 services**: PostgreSQL, Django backend, Next.js frontend, Prometheus, Loki, Tempo, OTel Collector, and Grafana.

### 3. Access the Application

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000/api/ |
| **Grafana** | http://localhost:3001 (admin/admin) |
| **Prometheus** | http://localhost:9090 |
| **Health Check** | http://localhost:8000/health/ |
| **Metrics** | http://localhost:8000/metrics |

### 4. Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Agent | agent1@helpdesk.com | Agent123!@# |
| Agent | agent2@helpdesk.com | Agent123!@# |
| Customer | customer1@helpdesk.com | Customer123!@# |
| Customer | customer2@helpdesk.com | Customer123!@# |

## 📊 Grafana Dashboards

Four pre-provisioned dashboards available at http://localhost:3001:

1. **Application Health** — Request rate, error rate %, P95 latency, slowest endpoints, active users
2. **Database Performance** — Query duration percentiles, slow queries, by operation
3. **Logs Explorer** — Error logs by severity, login failures, filter by trace_id
4. **Trace Explorer** — Tempo trace search, POST /api/tickets/ traces, trace view

## 🔧 Anomaly Injection

Toggle these in `.env` and restart the backend:

| Variable | Effect |
|----------|--------|
| `INJECT_DELAY=true` | Adds 0.5-2s delay to ticket list |
| `INJECT_SLOW_QUERY=true` | Uses unoptimized raw SQL query |
| `INJECT_ERRORS=true` | 20% of /api/tickets/ return 500 |

```bash
# Example: enable artificial delays
# Edit .env: INJECT_DELAY=true
docker-compose restart backend
```

## 🏋️ Load Testing

```bash
# Install k6: https://k6.io/docs/get-started/installation/
k6 run load_test.js

# Or with custom base URL
k6 run -e BASE_URL=http://localhost:8000 load_test.js
```

**Stages:** ramp to 50 VUs (1m) → hold (2m) → spike to 200 VUs (30s) → ramp down (1m)

## 🏗️ Project Structure

```
├── backend/              Django project
│   ├── helpdesk/         Settings, URLs, WSGI
│   ├── tickets/          Models, views, serializers
│   │   ├── middleware.py  Metrics + logging middleware
│   │   ├── tracing.py    OpenTelemetry setup
│   │   ├── anomalies.py  Injectable problems
│   │   └── health.py     Health check endpoint
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             Next.js (TypeScript)
│   ├── src/app/          App Router pages
│   ├── src/components/   Reusable components
│   ├── src/lib/          API client, auth context
│   └── Dockerfile
├── docker-compose.yml    8 services
├── prometheus/           Prometheus config
├── grafana/              Dashboards + provisioning
├── otel/                 OTel Collector config
├── tempo/                Tempo config
├── loki/                 Loki config
├── load_test.js          k6 load test
├── .env.example          Environment template
└── README.md             This file
```

## 🌟 Unique Feature: System Health Widget

The frontend dashboard includes a **live System Health widget** that:
- Polls `/health` every 5 seconds
- Queries Prometheus for real-time **request rate**, **error rate**, and **P95 latency**
- Shows color-coded cards (green/yellow/red) with animated pulse indicators
- The app visualizes its own observability metrics in real-time!

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register/` | Register new user |
| POST | `/api/login/` | Login (returns JWT) |
| GET | `/api/me/` | Current user info |
| GET | `/api/users/` | List agents |
| GET | `/api/tickets/` | List tickets (paginated, filterable) |
| POST | `/api/tickets/` | Create ticket |
| GET | `/api/tickets/{id}/` | Ticket detail with comments |
| PATCH | `/api/tickets/{id}/` | Update ticket |
| DELETE | `/api/tickets/{id}/` | Delete ticket |
| GET | `/api/tickets/{id}/comments/` | List comments |
| POST | `/api/tickets/{id}/comments/` | Add comment |
| GET | `/health/` | Health check |
| GET | `/metrics` | Prometheus metrics |

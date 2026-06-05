# Cypress E2E Test Suite — HelpDesk AI

> End-to-end tests for company settings persistence, webhook configurations, and real-time ticket timeline updates.

## Overview

This directory contains the Cypress E2E test suite for the HelpDesk AI application, covering the requirements in GitHub Issue [#1404](https://github.com/ritesh-1918/HELPDESK.AI/issues/1404).

### Covered Requirements

| Test File | Requirement | Status |
|---|---|---|
| `e2e/admin-login.cy.js` | Configure Cypress with standardized admin login fixtures | ✅ |
| `e2e/settings-persistence.cy.js` | Settings updates persist to backend API and reflect on reload | ✅ |
| `e2e/timeline-websocket.cy.js` | Mock WebSocket events and verify timeline dynamically updates | ✅ |

---

## Setup

### Prerequisites

- Node.js 18+ and npm
- The frontend dev server must be running: `npm run dev`
- Backend API must be accessible (default: `http://localhost:4000/api`)

### Installation

Cypress is already listed in `devDependencies` (`Frontend/package.json`).

```bash
cd Frontend
npm install
```

### Configure Environment Variables

Create `cypress.env.json` in the `Frontend/` directory:

```json
{
  "admin_email": "your-admin@helpdesk.local",
  "admin_password": "your-admin-password",
  "apiBaseUrl": "http://localhost:4000/api"
}
```

> ⚠️ Never commit `cypress.env.json` to version control. It is already in `.gitignore`.

---

## Running Tests

### Run all tests (headless)

```bash
cd Frontend
npm run cypress:run
```

### Open Cypress UI (interactive)

```bash
cd Frontend
npm run cypress:open
```

### Run specific test file

```bash
cd Frontend
npx cypress run --spec "cypress/e2e/settings-persistence.cy.js"
```

### Run tests against a specific base URL

```bash
CYPRESS_BASE_URL=http://staging.helpdesk.ai npm run cypress:run
```

---

## Test Architecture

```
cypress/
├── fixtures/              # Static JSON test data
│   └── admin-login.json   # Admin user credentials
├── support/
│   ├── e2e.js            # Global test configuration
│   └── commands.js      # Custom commands (login, mock, etc.)
├── e2e/
│   ├── admin-login.cy.js          # Login fixture tests
│   ├── settings-persistence.cy.js # Settings persistence tests
│   └── timeline-websocket.cy.js   # Real-time WebSocket tests
└── cypress.json (or cypress.config.js)
```

---

## Custom Commands

These are defined in `cypress/support/commands.js`:

| Command | Description |
|---|---|
| `cy.loginAsAdmin()` | Log in with admin fixture; session persists across tests |
| `cy.mockSettingsUpdate(data)` | Stub PUT/PATCH to `/api/settings` with custom response |
| `cy.stubTimelineWebSocket(ticketId, eventType, payload)` | Stub WebSocket/timeline subscription and polling |
| `cy.expectToast(message)` | Assert a toast notification appeared |
| `cy.reloadAndVerify(selector, op, value)` | Reload and verify a DOM value persisted |

---

## WebSocket Testing Strategy

The timeline tests stub the WebSocket connection using `cy.stubTimelineWebSocket()`, which intercepts:

1. `GET /ws/timeline*` — WebSocket upgrade (stubbed to 101 Switching Protocols)
2. `GET /api/timeline/**` — HTTP long-poll fallback
3. `POST /api/timeline/subscribe` — Timeline subscription

The app is then triggered via `window.dispatchEvent(new CustomEvent('timeline:update', {...}))`, simulating what the real WebSocket handler would do internally.

If your app uses a different WebSocket library (e.g., `socket.io-client`, `ws`), adjust the `cy.stubTimelineWebSocket()` implementation in `commands.js` to match your library's transport mechanism.

---

## Troubleshooting

### "Cannot connect to WebSocket"

If your app uses a native `WebSocket` object, Cypress can't stub it directly. The recommended approach is to:

1. Use an HTTP-based polling fallback (which Cypress *can* intercept)
2. Or dispatch `CustomEvent` directly as done in these tests

### Tests fail on CI but pass locally

Set `retries` in `cypress.json`:

```json
{
  "retries": { "runMode": 2, "openMode": 0 }
}
```

---

## Route Adaptation

The test files use these assumed routes. Update them to match your actual application routes:

| Test | Assumed Route | Update In |
|---|---|---|
| Login | `/login` | All test files |
| Admin Settings | `/admin/settings` | `settings-persistence.cy.js` |
| Ticket Detail | `/admin/tickets/:id` | `timeline-websocket.cy.js` |

If your app uses different selectors (e.g., `data-testid` attributes instead of CSS classes), update the selectors in the relevant test files.

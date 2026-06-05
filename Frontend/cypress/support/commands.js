/// <reference types="cypress" />

/**
 * Custom Cypress commands for the HelpDesk AI application.
 * These encapsulate common patterns: admin login, settings save, etc.
 */

/**
 * Login as an admin user.
 * Uses the admin credentials from cypress.env.json or default test fixtures.
 *
 * Usage: cy.loginAsAdmin()
 */
Cypress.Commands.add('loginAsAdmin', (overrides = {}) => {
  const defaultAdmin = {
    email: Cypress.env('admin_email') || 'admin@helpdesk.local',
    password: Cypress.env('admin_password') || 'adminpassword123',
  };

  const admin = { ...defaultAdmin, ...overrides };

  cy.session([admin.email], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"], input[name="email"], input[type="email"]')
      .first()
      .type(admin.email);
    cy.get('[data-testid="password-input"], input[name="password"], input[type="password"]')
      .first()
      .type(admin.password);
    cy.get('[data-testid="login-button"], button[type="submit"]').first().click();
    // Wait for redirect after successful login
    cy.url().should('not.include', '/login', { timeout: 10000 });
  });
});

/**
 * Intercept and mock an API call for settings updates.
 *
 * Usage:
 *   cy.mockSettingsUpdate({ companyName: 'New Company' })
 *   // Then trigger the settings save in your app
 *
 * @param {object} responseData - The data to return from the mocked API
 * @param {number} statusCode - HTTP status code (default: 200)
 */
Cypress.Commands.add('mockSettingsUpdate', (responseData = {}, statusCode = 200) => {
  cy.intercept('PUT', '**/api/settings', (req) => {
    req.reply({
      statusCode,
      body: {
        success: true,
        message: 'Settings updated successfully',
        data: responseData,
      },
    });
  }).as('settingsUpdate');

  cy.intercept('PATCH', '**/api/settings', (req) => {
    req.reply({
      statusCode,
      body: {
        success: true,
        message: 'Settings updated successfully',
        data: responseData,
      },
    });
  }).as('settingsUpdate');
});

/**
 * Intercept and stub WebSocket events for timeline testing.
 * Mocks the real-time event stream so tests don't depend on backend timing.
 *
 * Usage:
 *   cy.stubTimelineWebSocket();
 *   // Trigger a ticket status change in the app
 *   cy.wait('@timelineEvent').its('response.body.status').should('eq', 'closed');
 *
 * @param {string} ticketId - The ticket ID to stub events for
 * @param {string} eventType - Event type to simulate (e.g., 'ticket.status_changed')
 * @param {object} eventPayload - The event payload data
 */
Cypress.Commands.add(
  'stubTimelineWebSocket',
  { prevSubject: false },
  (ticketId, eventType = 'ticket.status_changed', eventPayload = {}) => {
    const defaultPayload = {
      id: ticketId || 'TICKET-001',
      event_type: eventType,
      timestamp: new Date().toISOString(),
      data: {
        ticket_id: ticketId || 'TICKET-001',
        old_status: 'open',
        new_status: 'in_progress',
        changed_by: 'agent-01',
        ...eventPayload,
      },
    };

    // Stub WebSocket connection if app uses native WS
    cy.intercept(
      {
        method: 'GET',
        url: '**/ws/timeline*',
      },
      (req) => {
        req.reply({
          statusCode: 101,
          body: '',
        });
      }
    ).as('wsConnection');

    // Also intercept any HTTP long-poll fallback the app might use
    cy.intercept('GET', '**/api/timeline/**', (req) => {
      req.reply({
        statusCode: 200,
        body: defaultPayload,
      });
    }).as('timelinePoll');

    // Intercept POST for subscribing to ticket timeline
    cy.intercept('POST', '**/api/timeline/subscribe', (req) => {
      req.reply({
        statusCode: 200,
        body: { subscribed: true, ticket_id: ticketId || 'TICKET-001' },
      });
    }).as('timelineSubscribe');
  }
);

/**
 * Assert that a notification toast appeared.
 * Works with common toast libraries (antd, react-hot-toast, etc.)
 *
 * Usage: cy.expectToast('Settings saved successfully')
 */
Cypress.Commands.add('expectToast', (messageSubstring) => {
  cy.contains('[role="alert"], .toast, [data-testid="toast"], .ant-message', messageSubstring, {
    timeout: 5000,
  }).should('be.visible');
});

/**
 * Reload the page and verify a value is persisted.
 * Use for testing localStorage or sessionStorage persistence.
 *
 * Usage:
 *   cy.get('[data-testid="company-name"]').should('contain', 'My Company');
 *   cy.reloadAndVerify('[data-testid="company-name"]', 'contain', 'My Company');
 */
Cypress.Commands.add('reloadAndVerify', (selector, operation, value) => {
  cy.reload();
  cy.get(selector).should(operation, value);
});

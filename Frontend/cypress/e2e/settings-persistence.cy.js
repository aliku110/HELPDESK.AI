/// <reference types="cypress" />

describe('Admin Settings Persistence', () => {
  /**
   * End-to-end tests for company settings persistence.
   *
   * Covers: Issue #1404 - "Settings Workflows" requirement:
   * "Write test specs asserting that settings updates correctly
   *  persist to the backend API and reflect on reload."
   *
   * Test Strategy:
   * 1. Login as admin
   * 2. Navigate to settings page
   * 3. Update a setting value
   * 4. Verify the API call was made with correct payload
   * 5. Reload and verify the value persisted
   */

  beforeEach(() => {
    cy.fixture('admin-login').as('admin');
    cy.loginAsAdmin();
  });

  // -------------------------------------------------------------------------
  // Helper: go to the settings page
  // Adjust '/admin/settings' to match your actual routes
  // -------------------------------------------------------------------------
  const visitSettings = () => {
    cy.visit('/admin/settings');
    cy.get('body', { timeout: 10000 }).should('be.visible');
  };

  // -------------------------------------------------------------------------
  // Test: Company Name field
  // -------------------------------------------------------------------------
  it('should update company name and persist after reload', function () {
    visitSettings();

    const newCompanyName = 'Acme HelpDesk Corp';

    // Find company name input (try multiple common selectors)
    cy.get('input[name="companyName"], input[placeholder*="company" i], input[id*="company"]')
      .first()
      .clear()
      .type(newCompanyName);

    // Intercept the settings update API call
    cy.mockSettingsUpdate({ companyName: newCompanyName });

    // Click save button
    cy.get('button[type="submit"], button:contains("Save"), button:contains("Update")')
      .first()
      .click();

    // Verify API was called
    cy.wait('@settingsUpdate', { timeout: 5000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
    });

    // Verify success notification
    cy.expectToast('saved', 'Settings updated successfully');

    // Reload and verify persistence
    cy.reloadAndVerify(
      'input[name="companyName"], input[placeholder*="company" i]',
      'have.value',
      newCompanyName
    );
  });

  // -------------------------------------------------------------------------
  // Test: Webhook URL field
  // -------------------------------------------------------------------------
  it('should update webhook URL and persist after reload', () => {
    visitSettings();

    const newWebhookUrl = 'https://example.com/webhooks/helpdesk';

    cy.get('input[name="webhookUrl"], input[placeholder*="webhook" i], input[id*="webhook"]')
      .first()
      .clear()
      .type(newWebhookUrl);

    cy.mockSettingsUpdate({ webhookUrl: newWebhookUrl });

    cy.get('button[type="submit"], button:contains("Save"), button:contains("Update")')
      .first()
      .click();

    cy.wait('@settingsUpdate', { timeout: 5000 }).its('response.statusCode').should('eq', 200);

    cy.reloadAndVerify(
      'input[name="webhookUrl"], input[placeholder*="webhook" i]',
      'have.value',
      newWebhookUrl
    );
  });

  // -------------------------------------------------------------------------
  // Test: Auto-close ticket notification settings
  // -------------------------------------------------------------------------
  it('should update auto-close ticket days setting and persist after reload', () => {
    visitSettings();

    const autoCloseDays = '14';

    // Find the auto-close days input (could be number input or text input)
    cy.get('input[name="autoCloseDays"], input[type="number"][name*="close" i], input[id*="autoClose"]')
      .first()
      .clear()
      .type(autoCloseDays);

    cy.mockSettingsUpdate({ autoCloseDays: parseInt(autoCloseDays, 10) });

    cy.get('button[type="submit"], button:contains("Save"), button:contains("Update")')
      .first()
      .click();

    cy.wait('@settingsUpdate', { timeout: 5000 }).its('response.statusCode').should('eq', 200);

    // Reload and check value persisted
    cy.reload();
    cy.get('input[name="autoCloseDays"], input[type="number"][name*="close" i], input[id*="autoClose"]')
      .first()
      .should('have.value', autoCloseDays);
  });

  // -------------------------------------------------------------------------
  // Test: API error handling - settings update fails
  // -------------------------------------------------------------------------
  it('should show error message when settings update API fails', () => {
    visitSettings();

    // Intercept with server error
    cy.intercept('PUT', '**/api/settings', {
      statusCode: 500,
      body: { success: false, message: 'Internal server error' },
    }).as('settingsUpdateFail');

    cy.get('input[name="companyName"], input[placeholder*="company" i]')
      .first()
      .clear()
      .type('Should Not Persist');

    cy.get('button[type="submit"], button:contains("Save"), button:contains("Update")')
      .first()
      .click();

    cy.wait('@settingsUpdateFail', { timeout: 5000 })
      .its('response.statusCode')
      .should('eq', 500);

    // Error should be shown to user (not in a toast - check for error message)
    cy.get('body').should('contain', 'error', 'Error');

    // Reload and verify the failed value did NOT persist
    cy.reload();
    cy.get('input[name="companyName"], input[placeholder*="company" i]')
      .first()
      .should('not.have.value', 'Should Not Persist');
  });

  // -------------------------------------------------------------------------
  // Test: Validation - empty required fields
  // -------------------------------------------------------------------------
  it('should show validation error when required field is empty', () => {
    visitSettings();

    // Clear a required field
    cy.get('input[name="companyName"], input[placeholder*="company" i]')
      .first()
      .clear();

    cy.get('button[type="submit"], button:contains("Save"), button:contains("Update")')
      .first()
      .click();

    // Should NOT make an API call for empty required fields
    // (cypress will timeout if wait is called and request never happened)
    cy.get('[role="alert"], .text-red, .error, [data-testid="error"]').should('exist');
  });

  // -------------------------------------------------------------------------
  // Test: Settings form tabs / sections
  // -------------------------------------------------------------------------
  it('should switch between settings tabs and retain form state', () => {
    visitSettings();

    const testEmail = 'support@example.com';

    // Fill in email field
    cy.get('input[name="supportEmail"], input[type="email"][name*="support" i]')
      .first()
      .clear()
      .type(testEmail);

    // Switch tabs if tabs exist
    const tabs = cy.get('[role="tab"], .tab, button:has-text("General"), button:has-text("Notifications")');
    tabs.then(($tabs) => {
      if ($tabs.length > 1) {
        // Click second tab
        $tabs.eq(1).click();
        cy.wait(500);
        // Go back to first tab
        $tabs.eq(0).click();
        cy.wait(500);
        // Verify form state preserved
        cy.get('input[name="supportEmail"], input[type="email"][name*="support" i]')
          .first()
          .should('have.value', testEmail);
      }
    });
  });
});

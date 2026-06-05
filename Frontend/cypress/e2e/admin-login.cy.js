/// <reference types="cypress" />

describe('Admin Login Flow', () => {
  /**
   * Test that admin can log in with valid credentials
   * and that the session persists across page reloads.
   *
   * Covers: Issue #1404 - Cypress Setup requirement
   */

  beforeEach(() => {
    // Load admin fixture
    cy.fixture('admin-login').as('admin');
  });

  it('should load admin login page', () => {
    cy.visit('/login');
    cy.get('body').should('be.visible');
    // Check that email and password fields are present
    cy.get('input[type="email"], input[name="email"]').should('exist');
    cy.get('input[type="password"], input[name="password"]').should('exist');
  });

  it('should log in successfully with valid admin credentials', function () {
    cy.visit('/login');

    cy.get('input[type="email"], input[name="email"]').first().type(this.admin.email);
    cy.get('input[type="password"], input[name="password"]').first().type(this.admin.password);
    cy.get('button[type="submit"]').first().click();

    // Verify redirect away from login page
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  });

  it('should persist session across page reload', function () {
    // Login first
    cy.loginAsAdmin({ email: this.admin.email, password: this.admin.password });

    // Navigate away and come back
    cy.visit('/');
    cy.visit('/login');
    cy.url({ timeout: 5000 }).should('not.include', '/login');

    // Reload the page - session should still be valid
    cy.reload();
    cy.url({ timeout: 5000 }).should('not.include', '/login');
  });

  it('should have admin role after login', function () {
    cy.loginAsAdmin({ email: this.admin.email, password: this.admin.password });

    // Visit admin dashboard
    cy.visit('/admin');

    // The admin dashboard should load without redirecting back to login
    cy.url({ timeout: 10000 }).should('not.include', '/login');
    cy.get('body').should('contain');
  });

  it('should log out and clear session', () => {
    cy.loginAsAdmin();

    // Click logout button (common selectors)
    cy.get('button[aria-label="logout"], button:contains("Logout"), button:contains("Sign Out")')
      .first()
      .click();

    // Verify redirect to login
    cy.url({ timeout: 5000 }).should('include', '/login');
  });

  it('should load admin fixture correctly', function () {
    expect(this.admin.email).to.be.a('string');
    expect(this.admin.password).to.be.a('string');
    expect(this.admin.role).to.eq('admin');
  });
});

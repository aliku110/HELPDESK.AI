/// <reference types="cypress" />

// Import commands
import './commands';

// Global Cypress configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing tests on uncaught exceptions from the app
  // We log it for debugging purposes
  console.error('[Cypress] Uncaught exception:', err.message);
  return false;
});

// Clear localStorage and sessionStorage between tests for isolation
beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearSessionStorage();
});

// Log any failed XHR requests for debugging (optional, toggle as needed)
// Cypress.on('fail', (error, runnable) => {
//   // Add custom debugging info here if needed
//   throw error;
// });

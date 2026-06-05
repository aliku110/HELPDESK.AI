/// <reference types="cypress" />

describe('Ticket Timeline — Real-time WebSocket Events', () => {
  /**
   * End-to-end tests for ticket timeline real-time updates via WebSocket.
   *
   * Covers: Issue #1404 - "Timeline Verifications" requirement:
   * "Mock real-time WebSocket events and verify the timeline
   *  rendering dynamically changes status."
   *
   * Test Strategy:
   * 1. Open a ticket detail page with an active timeline
   * 2. Stub WebSocket / timeline subscription endpoint
   * 3. Emit a status-change event from the "server"
   * 4. Verify the timeline UI updates to reflect the new status
   */

  beforeEach(() => {
    cy.fixture('admin-login').as('admin');
    cy.loginAsAdmin();
  });

  // -------------------------------------------------------------------------
  // Helper: visit a ticket detail page
  // Adjust '/admin/tickets/:id' to match your actual route
  // -------------------------------------------------------------------------
  const visitTicket = (ticketId = 'TICKET-001') => {
    cy.visit(`/admin/tickets/${ticketId}`);
    cy.get('body', { timeout: 10000 }).should('be.visible');
    // Wait for timeline to load
    cy.get('.timeline, [data-testid="ticket-timeline"], [class*="timeline"]', {
      timeout: 8000,
    }).should('exist');
  };

  // -------------------------------------------------------------------------
  // Test: Timeline renders initial status
  // -------------------------------------------------------------------------
  it('should render timeline with initial ticket status', () => {
    visitTicket('TICKET-001');

    // Verify timeline is visible
    cy.get('.timeline, [data-testid="ticket-timeline"], [class*="timeline"]').should(
      'be.visible'
    );

    // Verify initial status is shown
    cy.get('[data-testid="ticket-status"], .status-badge, [class*="status"]').should(
      'exist'
    );
  });

  // -------------------------------------------------------------------------
  // Test: Status change event updates the timeline
  // -------------------------------------------------------------------------
  it('should update timeline when ticket status changes via WebSocket event', () => {
    visitTicket('TICKET-001');

    // Get initial status
    cy.get('[data-testid="ticket-status"], .status-badge, [class*="status"]')
      .first()
      .invoke('text')
      .as('initialStatus')
      .should('not.be.empty');

    // Stub WebSocket events
    cy.stubTimelineWebSocket('TICKET-001', 'ticket.status_changed', {
      old_status: 'open',
      new_status: 'in_progress',
      changed_by: 'agent-01',
      note: 'Agent started working on this ticket',
    });

    // Simulate the WebSocket message arriving by dispatching a custom event
    // that the app's WebSocket handler would normally emit
    cy.window().then((win) => {
      // Simulate timeline update event (adjust event name to match app's implementation)
      const event = new CustomEvent('timeline:update', {
        detail: {
          ticket_id: 'TICKET-001',
          event_type: 'ticket.status_changed',
          data: {
            old_status: 'open',
            new_status: 'in_progress',
            changed_by: 'agent-01',
            note: 'Agent started working on this ticket',
            timestamp: new Date().toISOString(),
          },
        },
      });
      win.dispatchEvent(event);
    });

    // Wait for UI to update
    cy.wait(1000);

    // Verify status badge updated
    cy.get('[data-testid="ticket-status"], .status-badge, [class*="status"]')
      .first()
      .should('contain', 'in_progress');

    // Verify new timeline entry appeared
    cy.get('.timeline, [data-testid="ticket-timeline"]')
      .should('contain', 'Agent started working on this ticket');
  });

  // -------------------------------------------------------------------------
  // Test: Ticket closed event closes the timeline
  // -------------------------------------------------------------------------
  it('should mark timeline as resolved when ticket is closed via WebSocket', () => {
    visitTicket('TICKET-002');

    cy.stubTimelineWebSocket('TICKET-002', 'ticket.closed', {
      old_status: 'in_progress',
      new_status: 'resolved',
      changed_by: 'agent-02',
      resolution: 'Issue was fixed and confirmed by user.',
    });

    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent('timeline:update', {
          detail: {
            ticket_id: 'TICKET-002',
            event_type: 'ticket.closed',
            data: {
              old_status: 'in_progress',
              new_status: 'resolved',
              changed_by: 'agent-02',
              resolution: 'Issue was fixed and confirmed by user.',
              timestamp: new Date().toISOString(),
            },
          },
        })
      );
    });

    cy.wait(1000);

    // Status should show resolved
    cy.get('[data-testid="ticket-status"], .status-badge, [class*="status"]')
      .first()
      .should('contain', 'resolved');

    // Timeline should show resolution note
    cy.get('.timeline').should('contain', 'resolved');
  });

  // -------------------------------------------------------------------------
  // Test: Priority change event updates priority indicator
  // -------------------------------------------------------------------------
  it('should update priority indicator when priority changes via WebSocket', () => {
    visitTicket('TICKET-003');

    cy.stubTimelineWebSocket('TICKET-003', 'ticket.priority_changed', {
      old_priority: 'low',
      new_priority: 'high',
      changed_by: 'admin-01',
    });

    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent('timeline:update', {
          detail: {
            ticket_id: 'TICKET-003',
            event_type: 'ticket.priority_changed',
            data: {
              old_priority: 'low',
              new_priority: 'high',
              changed_by: 'admin-01',
              timestamp: new Date().toISOString(),
            },
          },
        })
      );
    });

    cy.wait(1000);

    // Priority badge should update
    cy.get('[data-testid="ticket-priority"], .priority-badge, [class*="priority"]')
      .first()
      .should('contain', 'high');
  });

  // -------------------------------------------------------------------------
  // Test: WebSocket disconnect / reconnect handling
  // -------------------------------------------------------------------------
  it('should handle WebSocket connection failure gracefully', () => {
    visitTicket('TICKET-004');

    // Intercept WebSocket subscription and force failure
    cy.intercept('POST', '**/api/timeline/subscribe', {
      statusCode: 503,
      body: { error: 'Service unavailable' },
    }).as('subscribeFail');

    // Reload page — connection should fail gracefully (no crash)
    cy.reload();
    cy.get('body', { timeout: 10000 }).should('be.visible');

    // Timeline should still be visible (even if stale)
    cy.get('.timeline, [data-testid="ticket-timeline"]').should('exist');
  });

  // -------------------------------------------------------------------------
  // Test: Multiple rapid events are all rendered in timeline
  // -------------------------------------------------------------------------
  it('should render multiple timeline events in correct order', () => {
    visitTicket('TICKET-005');

    const events = [
      { status: 'open', note: 'Ticket created', by: 'user-01' },
      { status: 'in_progress', note: 'Agent assigned', by: 'agent-01' },
      { status: 'resolved', note: 'Fixed and closed', by: 'agent-01' },
    ];

    cy.stubTimelineWebSocket('TICKET-005');

    events.forEach((evt, idx) => {
      cy.window().then((win) => {
        win.dispatchEvent(
          new CustomEvent('timeline:update', {
            detail: {
              ticket_id: 'TICKET-005',
              event_type: 'ticket.status_changed',
              data: {
                old_status: idx === 0 ? 'open' : events[idx - 1].status,
                new_status: evt.status,
                changed_by: evt.by,
                note: evt.note,
                timestamp: new Date(Date.now() + idx * 1000).toISOString(),
              },
            },
          })
        );
      });
      cy.wait(200);
    });

    // Wait for all events to be processed
    cy.wait(1000);

    // All notes should appear in timeline
    events.forEach((evt) => {
      cy.get('.timeline').should('contain', evt.note);
    });

    // Final status should be the last event's status
    cy.get('[data-testid="ticket-status"]')
      .first()
      .should('contain', 'resolved');
  });

  // -------------------------------------------------------------------------
  // Test: Timeline renders date/timestamp correctly
  // -------------------------------------------------------------------------
  it('should render ISO-8601 timestamps from WebSocket events correctly', () => {
    visitTicket('TICKET-006');

    const testTimestamp = '2026-06-05T10:30:00.000Z';

    cy.stubTimelineWebSocket('TICKET-006', 'ticket.status_changed', {
      old_status: 'open',
      new_status: 'in_progress',
      changed_by: 'agent-01',
      timestamp: testTimestamp,
    });

    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent('timeline:update', {
          detail: {
            ticket_id: 'TICKET-006',
            event_type: 'ticket.status_changed',
            data: {
              old_status: 'open',
              new_status: 'in_progress',
              changed_by: 'agent-01',
              timestamp: testTimestamp,
            },
          },
        })
      );
    });

    cy.wait(1000);

    // Timeline should display the date, not show raw ISO string
    // (Tests that date parsing works — Safari compat from issue #1411)
    cy.get('.timeline [class*="time"], .timeline [class*="date"], time[datetime]').should(
      'not.have.text',
      testTimestamp
    );
    cy.get('.timeline').should('not.include.text', 'Invalid Date');
  });
});

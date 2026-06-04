import React, { Component } from 'react';

/**
 * Global Error Boundary component.
 * Catches React render errors and displays a styled error page
 * with a "copy error payload" button for rapid customer bug reporting.
 */
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }

    /**
     * Build a structured error payload for easy copy/paste in bug reports.
     */
    getErrorPayload() {
        const { error, errorInfo } = this.state;
        const payload = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            error: {
                name: error?.name || 'Unknown',
                message: error?.message || String(error),
                stack: error?.stack || null,
            },
            componentStack: errorInfo?.componentStack || null,
        };
        return JSON.stringify(payload, null, 2);
    }

    copyPayload = () => {
        const payload = this.getErrorPayload();
        navigator.clipboard.writeText(payload).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2500);
        }).catch(() => {
            // Fallback for environments without clipboard API
            const ta = document.createElement('textarea');
            ta.value = payload;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2500);
        });
    };

    resetError = () => {
        this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    };

    render() {
        if (this.state.hasError) {
            const { error, errorInfo, copied } = this.state;

            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0f0f1a',
                    padding: '24px',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                    <div style={{
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #2d2d44',
                        borderRadius: '16px',
                        padding: '40px',
                        maxWidth: '600px',
                        width: '100%',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                        {/* Error icon */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '24px',
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" 
                                    stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>

                        <h2 style={{
                            color: '#f87171',
                            fontSize: '22px',
                            fontWeight: '700',
                            marginBottom: '8px',
                        }}>
                            Something went wrong
                        </h2>

                        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                            An unexpected error occurred. Your session has been preserved.
                            Copy the error details below and contact support.
                        </p>

                        {/* Error message */}
                        <div style={{
                            backgroundColor: '#0f0f1a',
                            border: '1px solid #2d2d44',
                            borderRadius: '10px',
                            padding: '16px',
                            marginBottom: '24px',
                        }}>
                            <p style={{ color: '#f87171', fontSize: '13px', fontFamily: 'monospace', margin: 0, wordBreak: 'break-word' }}>
                                {error?.message || 'Unknown error occurred'}
                            </p>
                        </div>

                        {/* Copy button */}
                        <button
                            onClick={this.copyPayload}
                            style={{
                                width: '100%',
                                padding: '12px 24px',
                                backgroundColor: copied ? '#22c55e' : '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {copied ? (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Copied to clipboard!
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                    Copy Error Payload
                                </>
                            )}
                        </button>

                        {/* Try again */}
                        <button
                            onClick={this.resetError}
                            style={{
                                width: '100%',
                                padding: '10px 24px',
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                border: '1px solid #2d2d44',
                                borderRadius: '10px',
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Copy error payload utility - import and use in any component
 * that wants to expose a "copy error" button for customers.
 */
export const copyErrorPayload = (error, errorInfo) => {
    const payload = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        error: {
            name: error?.name || 'Unknown',
            message: error?.message || String(error),
            stack: error?.stack || null,
        },
        componentStack: errorInfo?.componentStack || null,
    };

    const jsonStr = JSON.stringify(payload, null, 2);

    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(jsonStr);
    }

    // Fallback
    const ta = document.createElement('textarea');
    ta.value = jsonStr;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
};

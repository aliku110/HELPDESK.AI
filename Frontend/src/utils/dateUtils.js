/**
 * Unified Date Utility for HELPDESK.AI
 * Fixed for Safari, Firefox, and Chrome cross-browser compatibility.
 * Includes robust fallbacks for empty/corrupt dates.
 */

/**
 * Normalize a date string to ISO-8601 format for cross-browser parsing.
 * Handles formats Safari struggles with: space-separated, +/- timezone without T, etc.
 */
const normalizeDateString = (dateStr) => {
    if (typeof dateStr !== 'string' || !dateStr.trim()) {
        return null;
    }

    let normalized = dateStr.trim();

    // Replace space between date and time with 'T' (Safari needs this)
    // e.g. "2024-01-15 10:30:00" -> "2024-01-15T10:30:00Z"
    const spaceIndex = normalized.indexOf(' ');
    if (spaceIndex !== -1 && !normalized.includes('T')) {
        const datePart = normalized.substring(0, spaceIndex);
        const timePart = normalized.substring(spaceIndex + 1);
        // Append Z if no timezone info
        const tzSuffix = /[Z+-]\d{2}:?\d{2}$/.test(normalized) ? '' : 'Z';
        normalized = datePart + 'T' + timePart + tzSuffix;
    }

    return normalized;
};

/**
 * Parse a date string cross-browser (Safari-safe).
 * Returns null for invalid/empty dates.
 */
const parseSafe = (dateStr) => {
    if (!dateStr) return null;

    const normalized = normalizeDateString(dateStr);
    if (!normalized) return null;

    const date = new Date(normalized);
    if (isNaN(date.getTime())) return null;

    return date;
};

/**
 * Format a date string for the Ticket Timeline.
 * Safari-safe with graceful fallback to current time.
 */
export const formatTimelineDate = (dateStr) => {
    // Fallback: if dateStr is missing/null, use current time
    if (!dateStr) {
        return new Date().toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    const date = parseSafe(dateStr);

    // Fallback: if parsing fails, use current time instead of showing 'Invalid Date'
    if (!date) {
        return new Date().toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    return date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

/**
 * Get the current timezone abbreviation.
 * Works across Safari, Firefox, and Chrome.
 */
export const getTimeZoneAbbr = () => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short'
        })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value || 'IST';
    } catch (_e) {
        return 'IST';
    }
};

/**
 * Format a full timestamp with timezone.
 */
export const formatFullTimestamp = (dateStr) => {
    if (!dateStr) {
        return 'Processing...';
    }

    const date = parseSafe(dateStr);
    if (!date) {
        return 'Processing...';
    }

    const formatted = date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return `${formatted} (${getTimeZoneAbbr()})`;
};

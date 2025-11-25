/**
 * Time utility functions for Convex operations
 * Centralizes date/time calculations used across cleanup, jobs, and analyses
 */

// Time constants in milliseconds
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Get a timestamp for N days ago
 */
export function daysAgo(days: number): number {
  return Date.now() - days * MS_PER_DAY;
}

/**
 * Get a timestamp for N hours ago
 */
export function hoursAgo(hours: number): number {
  return Date.now() - hours * MS_PER_HOUR;
}

/**
 * Calculate age in days from a timestamp
 */
export function ageInDays(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / MS_PER_DAY);
}

/**
 * Calculate age in hours from a timestamp
 */
export function ageInHours(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / MS_PER_HOUR);
}

/**
 * Check if a timestamp is older than N days
 */
export function isOlderThanDays(timestamp: number, days: number): boolean {
  return timestamp < daysAgo(days);
}

/**
 * Check if a timestamp is older than N hours
 */
export function isOlderThanHours(timestamp: number, hours: number): boolean {
  return timestamp < hoursAgo(hours);
}

/**
 * Coerce various timestamp formats to Unix epoch milliseconds
 * Handles: Unix seconds, Unix milliseconds, ISO strings, date strings
 */
export function coerceTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Already in milliseconds (after year 2001)
    if (value > 1_000_000_000_000) {
      return value;
    }
    // Unix seconds - convert to milliseconds
    if (value > 1_000_000_000) {
      return value * 1000;
    }
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      if (numeric > 1_000_000_000_000) {
        return numeric;
      }
      if (numeric > 1_000_000_000) {
        return numeric * 1000;
      }
    }

    // Try parsing as date string
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

/**
 * Convert provider wording into short, consistent messages suitable for the
 * customer UI. Keep raw provider responses in server logs / encrypted records,
 * never in the message returned to a customer.
 */
export function publicVerificationMessage(value: unknown, fallback: string) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message) return fallback;

  const normalized = message.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (/\b(nin|national identity number)\b.*\b(suspend|suspended|deactivat|blocked)\b|\b(suspend|suspended|deactivat|blocked)\b.*\b(nin|national identity number)\b/.test(normalized)) {
    return 'This NIN has been suspended. Please contact NIMC for assistance.';
  }
  if (/\b(bvn|bank verification number)\b.*\b(suspend|suspended|deactivat|blocked)\b|\b(suspend|suspended|deactivat|blocked)\b.*\b(bvn|bank verification number)\b/.test(normalized)) {
    return 'This BVN has been suspended. Please contact your bank for assistance.';
  }
  if (/\b(nin|national identity number)\b.*\b(must|should|needs? to|has to)\b.*\b(?:exactly\s+)?(11|eleven)\b.*\b(digit|number|character)/.test(normalized) || /\b(11|eleven)\s+digits?\b.*\b(nin|national identity number)\b/.test(normalized)) {
    return 'NIN must be 11 digits.';
  }
  if (/\b(bvn|bank verification number)\b.*\b(must|should|needs? to|has to)\b.*\b(?:exactly\s+)?(11|eleven)\b.*\b(digit|number|character)/.test(normalized) || /\b(11|eleven)\s+digits?\b.*\b(bvn|bank verification number)\b/.test(normalized)) {
    return 'BVN must be 11 digits.';
  }
  if (/\b(invalid|incorrect|not valid|wrong)\b.*\b(nin|national identity number)\b|\b(nin|national identity number)\b.*\b(invalid|incorrect|not valid|wrong)\b/.test(normalized)) {
    return 'Invalid NIN. Please check the number and try again.';
  }
  if (/\b(invalid|incorrect|not valid|wrong)\b.*\b(bvn|bank verification number)\b|\b(bvn|bank verification number)\b.*\b(invalid|incorrect|not valid|wrong)\b/.test(normalized)) {
    return 'Invalid BVN. Please check the number and try again.';
  }
  if (/\b(record|user|customer|data|details|account)\b.*\b(not found|does not exist|doesn't exist|not exist|unavailable)\b|\b(not found|no record|no match)\b/.test(normalized)) {
    return 'Record not found. Please check the details and try again.';
  }

  // Never echo arbitrary upstream text. The fallback is written by this app.
  return fallback;
}

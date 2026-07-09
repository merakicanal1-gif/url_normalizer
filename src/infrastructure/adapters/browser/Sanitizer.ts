export function sanitizePayload(payload: any): any {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }

  const sanitized: any = {};
  for (const key of Object.keys(payload)) {
    const val = payload[key];
    const lowerKey = key.toLowerCase();

    // Direct secret matching
    if (
      lowerKey === 'password' ||
      lowerKey === 'authorization' ||
      lowerKey === 'token' ||
      lowerKey === 'session-token' ||
      lowerKey === 'refresh-token' ||
      lowerKey === 'access-token' ||
      lowerKey.includes('secret')
    ) {
      sanitized[key] = '***';
    } else if (lowerKey === 'value' && (payload.name !== undefined || payload.domain !== undefined)) {
      // Cookie object detection: { name: '...', value: '...' }
      sanitized[key] = '***';
    } else {
      sanitized[key] = sanitizePayload(val);
    }
  }
  return sanitized;
}

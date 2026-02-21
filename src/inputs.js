export function parsePositiveInt(rawValue, inputName) {
  const raw = String(rawValue ?? '').trim();

  if (!/^\d+$/.test(raw)) {
    throw new Error(`Input "${inputName}" must be a positive integer. Received: ${rawValue}`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Input "${inputName}" must be a positive integer. Received: ${rawValue}`);
  }

  return value;
}

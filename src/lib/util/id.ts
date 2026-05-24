// Generate a UUID v4 with a Math.random fallback for older runtimes.
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `u_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

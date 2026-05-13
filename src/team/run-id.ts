export function generateRunId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

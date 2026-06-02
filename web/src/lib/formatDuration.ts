// Human-readable duration: 45s, 45mins, 13h, 1h 5mins, 24days 13hours
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}days ${hours}hours` : `${days}days`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}mins` : `${hours}h`;
  return `${mins}mins`;
}

let injected = false;
export function ensureQcf2Css() {
  if (injected) return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/fonts/qcf2/qcf2.css';
  document.head.appendChild(link);
}
export function pageFontFamily(page: number): string {
  return `QCF2P${page}`;
}

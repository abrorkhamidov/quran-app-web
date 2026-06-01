// Tajweed rule letter → colour. Letters come from the bracket dataset:
//   n natural madd · p permissible madd · o obligatory madd · m necessary madd
//   g ghunnah · a idgham-with-ghunnah · u idgham-without-ghunnah
//   f ikhfa · i iqlab · q qalqalah · h hamzat-wasl · s silent · l laam-shamsiyah
// Colours are chosen to read on both light and dark Quiet-Slate surfaces.

export const RULE_COLOR: Record<string, string> = {
  o: '#d6453f', // madd — obligatory (4–5)
  m: '#bb332d', // madd — necessary (6)
  p: '#dd7a33', // madd — permissible (2·4·6)
  n: '#c2922f', // madd — natural (2)
  g: '#1f9e6e', // ghunnah
  a: '#1f9e6e', // idgham with ghunnah
  f: '#2f7fd1', // ikhfa
  i: '#1597a3', // iqlab
  q: '#8a63d2', // qalqalah
  u: '#8b919b', // idgham without ghunnah (merged)
  h: '#9aa0aa', // hamzat wasl (connecting)
  s: '#9aa0aa', // silent
  l: '#9aa0aa', // laam shamsiyah (silent)
};

export const TAJWEED_LEGEND: { color: string; label: string }[] = [
  { color: '#d6453f', label: 'Madd — obligatory / necessary' },
  { color: '#dd7a33', label: 'Madd — permissible' },
  { color: '#c2922f', label: 'Madd — natural' },
  { color: '#1f9e6e', label: 'Ghunnah / Idghām' },
  { color: '#2f7fd1', label: 'Ikhfā’' },
  { color: '#1597a3', label: 'Iqlāb' },
  { color: '#8a63d2', label: 'Qalqalah' },
  { color: '#9aa0aa', label: 'Silent / connecting' },
];

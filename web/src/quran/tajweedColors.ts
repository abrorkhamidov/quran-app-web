// quran.com tajweed rule class → colour (reads on light + dark Quiet Slate).
export const RULE_COLOR: Record<string, string> = {
  madda_obligatory_mottasel: '#d6453f', // obligatory madd (muttasil 4–5)
  madda_necessary: '#bb332d', // necessary madd (lazim 6)
  madda_permissible: '#dd7a33', // permissible madd
  madda_obligatory_monfasel: '#dd7a33', // munfasil (permissible)
  madda_normal: '#c2922f', // natural madd
  ghunnah: '#1f9e6e',
  idgham_ghunnah: '#1f9e6e',
  idgham_shafawi: '#1f9e6e',
  ikhafa: '#2f7fd1',
  ikhafa_shafawi: '#2f7fd1',
  iqlab: '#1597a3',
  qalaqah: '#8a63d2', // (quran.com spelling of qalqalah)
  idgham_wo_ghunnah: '#8b919b',
  idgham_mutajanisayn: '#8b919b',
  ham_wasl: '#9aa0aa',
  slnt: '#9aa0aa',
  laam_shamsiyah: '#9aa0aa',
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

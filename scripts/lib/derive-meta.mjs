const REVELATION = { makkah: 'meccan', madinah: 'medinan' };

export function deriveSurahs(ayahRef, chapters) {
  const agg = new Map(); // surah -> { ayahCount, startPage }
  for (const a of ayahRef) {
    const cur = agg.get(a.surah) ?? { ayahCount: 0, startPage: a.page };
    cur.ayahCount = Math.max(cur.ayahCount, a.ayah);
    cur.startPage = Math.min(cur.startPage, a.page);
    agg.set(a.surah, cur);
  }
  return chapters
    .slice()
    .sort((x, y) => x.id - y.id)
    .map((c) => {
      const a = agg.get(c.id);
      if (!a) throw new Error(`no ayah data for surah ${c.id}`);
      return {
        id: c.id,
        name: c.name_simple,
        arabicName: c.name_arabic,
        ayahCount: a.ayahCount,
        startPage: a.startPage,
        revelation: REVELATION[c.revelation_place] ?? c.revelation_place,
      };
    });
}

export function deriveJuz(ayahRef) {
  const agg = new Map(); // juz -> { startSurah, startAyah, startPage, ayahCount }
  for (const a of ayahRef) {
    const cur = agg.get(a.juz);
    if (!cur) {
      agg.set(a.juz, { startSurah: a.surah, startAyah: a.ayah, startPage: a.page, ayahCount: 1 });
      continue;
    }
    cur.ayahCount += 1;
    const earlier = a.surah < cur.startSurah || (a.surah === cur.startSurah && a.ayah < cur.startAyah);
    if (earlier) {
      cur.startSurah = a.surah;
      cur.startAyah = a.ayah;
      cur.startPage = a.page;
    }
  }
  return [...agg.keys()]
    .sort((x, y) => x - y)
    .map((juz) => ({ juz, ...agg.get(juz) }));
}

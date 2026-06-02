export function stripHtml(s) {
  return String(s)
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '') // drop footnote markers entirely (e.g. "Allāh,1" -> "Allāh,")
    .replace(/<[^>]*>/g, '') // strip any remaining tags
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAyahList(surah, uthmaniVerses, translations) {
  if (uthmaniVerses.length !== translations.length) {
    throw new Error(`surah ${surah}: ${uthmaniVerses.length} verses vs ${translations.length} translations`);
  }
  return uthmaniVerses.map((v, i) => {
    const [s, ayah] = v.verse_key.split(':').map(Number);
    return { surah: s, ayah, text: v.text_uthmani, translation: stripHtml(translations[i].text) };
  });
}

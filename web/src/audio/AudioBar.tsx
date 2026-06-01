import { useReciters } from './useReciters';
import { useAudio } from './useAudio';
import { useSettings, } from '../settings/useSettings';
import { PLAYBACK_SPEEDS } from '../settings/SettingsContext';

export function AudioBar({ firstSurahAyah }: { firstSurahAyah: { surah: number; ayah: number } | null }) {
  const { data: reciters } = useReciters();
  const { isPlaying, toggle, playFrom, playingSurah } = useAudio();
  const { reciterId, setReciterId, playbackSpeed, setPlaybackSpeed } = useSettings();

  function onPlayPause() {
    if (playingSurah == null && firstSurahAyah) void playFrom(firstSurahAyah.surah, firstSurahAyah.ayah);
    else toggle();
  }

  return (
    <div className="sticky bottom-0 bg-card-light dark:bg-card-dark border-t border-muted/20 px-4 py-2 flex items-center gap-3">
      <button onClick={onPlayPause} className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center" aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <select className="bg-transparent text-sm text-ink dark:text-ink-dark" value={reciterId} onChange={(e) => setReciterId(Number(e.target.value))} aria-label="Reciter">
        {reciters?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select className="bg-transparent text-sm text-muted ml-auto" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} aria-label="Speed">
        {PLAYBACK_SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
      </select>
    </div>
  );
}

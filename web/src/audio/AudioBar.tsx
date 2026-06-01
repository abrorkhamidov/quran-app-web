import { useReciters } from './useReciters';
import { useAudio } from './useAudio';
import { useSettings } from '../settings/useSettings';
import { PLAYBACK_SPEEDS } from '../settings/SettingsContext';

export function AudioBar({ firstSurahAyah }: { firstSurahAyah: { surah: number; ayah: number } | null }) {
  const { data: reciters } = useReciters();
  const { isPlaying, toggle, playFrom, playingSurah } = useAudio();
  const { reciterId, setReciterId, playbackSpeed, setPlaybackSpeed } = useSettings();

  function onPlayPause() {
    if (playingSurah == null && firstSurahAyah) void playFrom(firstSurahAyah.surah, firstSurahAyah.ayah);
    else toggle();
  }

  const select = 'bg-transparent text-sm rounded-lg px-1.5 py-1 hover:bg-line-light/60 dark:hover:bg-line-dark/50 focus:outline-none cursor-pointer';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={onPlayPause}
        className="h-10 w-10 shrink-0 rounded-full bg-accent text-white grid place-items-center hover:opacity-95 transition"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <select className={`${select} text-ink dark:text-ink-dark`} value={reciterId} onChange={(e) => setReciterId(Number(e.target.value))} aria-label="Reciter">
        {reciters?.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <select className={`${select} text-muted ml-auto`} value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} aria-label="Speed">
        {PLAYBACK_SPEEDS.map((s) => (
          <option key={s} value={s}>{s}×</option>
        ))}
      </select>
    </div>
  );
}

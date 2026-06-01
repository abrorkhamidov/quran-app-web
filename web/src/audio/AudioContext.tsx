import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../settings/useSettings';
import { loadChapterTiming } from './useChapterTiming';
import type { ChapterTiming, HighlightedWord } from './types';

type AudioValue = {
  highlighted: HighlightedWord | null;
  isPlaying: boolean;
  playingSurah: number | null;
  playFrom: (surah: number, ayah: number) => Promise<void>;
  toggle: () => void;
  stop: () => void;
};

export const AudioContext = createContext<AudioValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { reciterId, playbackSpeed } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timingRef = useRef<ChapterTiming | null>(null);
  const versesRef = useRef<{ ayah: number; from: number; to: number; segments: number[][] }[]>([]);
  const [highlighted, setHighlighted] = useState<HighlightedWord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSurah, setPlayingSurah] = useState<number | null>(null);
  const playingSurahRef = useRef<number | null>(null);
  const playFromRef = useRef<((surah: number, ayah: number) => Promise<void>) | undefined>(undefined);

  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();

  // keep playbackRate in sync
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackSpeed; }, [playbackSpeed]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ms = audio.currentTime * 1000;
    const verses = versesRef.current;
    const v = verses.find((x) => ms >= x.from && ms < x.to);
    if (!v) return;
    const seg = v.segments.find((s) => ms >= s[1] && ms < s[2]);
    if (!seg) return;
    const surah = playingSurah;
    if (surah == null) return;
    setHighlighted((prev) =>
      prev && prev.surah === surah && prev.ayah === v.ayah && prev.position === seg[0]
        ? prev
        : { surah, ayah: v.ayah, position: seg[0] },
    );
  }, [playingSurah]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener('timeupdate', onTimeUpdate);
    const onEnd = () => {
      const cur = playingSurahRef.current;
      if (cur != null && cur < 114) {
        // continuous recitation: roll into the next surah when the chapter audio ends
        void playFromRef.current?.(cur + 1, 1);
      } else {
        setIsPlaying(false);
        setHighlighted(null);
      }
    };
    audio.addEventListener('ended', onEnd);
    return () => { audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnd); };
  }, [onTimeUpdate]);

  const playFrom = useCallback(async (surah: number, ayah: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const timing = await loadChapterTiming(reciterId, surah);
    timingRef.current = timing;
    versesRef.current = Object.entries(timing.verses)
      .map(([key, v]) => ({ ayah: Number(key.split(':')[1]), from: v.from, to: v.to, segments: v.segments }))
      .sort((a, b) => a.from - b.from);
    if (playingSurah !== surah || !audio.src.includes(encodeURI(timing.audioUrl).slice(-12))) {
      audio.src = timing.audioUrl;
    }
    const v = timing.verses[`${surah}:${ayah}`];
    audio.currentTime = v ? v.from / 1000 : 0;
    audio.playbackRate = playbackSpeed;
    setPlayingSurah(surah);
    playingSurahRef.current = surah;
    await audio.play();
    setIsPlaying(true);
  }, [reciterId, playbackSpeed, playingSurah]);

  // keep a ref to the latest playFrom so the 'ended' handler can auto-advance
  useEffect(() => { playFromRef.current = playFrom; }, [playFrom]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play(); setIsPlaying(true); }
    else { audio.pause(); setIsPlaying(false); }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setIsPlaying(false);
    setHighlighted(null);
  }, []);

  // reciter change mid-listen: reload current surah audio at current ayah
  useEffect(() => {
    if (playingSurah != null && highlighted) { void playFrom(playingSurah, highlighted.ayah); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId]);

  return (
    <AudioContext.Provider value={{ highlighted, isPlaying, playingSurah, playFrom, toggle, stop }}>
      {children}
    </AudioContext.Provider>
  );
}

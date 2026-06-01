import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { localDate } from './useStatsSummary';

const FLUSH_MS = 30_000;
const PAGE_DWELL_S = 3; // seconds of active time before a page counts as read

// Tracks active reading time + dwelt pages for the current page and flushes to the backend.
export function useReadingTracker(page: number) {
  const qc = useQueryClient();
  const secondsRef = useRef(0);
  const pagesRef = useRef<Set<number>>(new Set());
  const dwellRef = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  async function flush() {
    const seconds = secondsRef.current;
    const pages = [...pagesRef.current];
    if (seconds === 0 || pages.length === 0) return;
    secondsRef.current = 0;
    pagesRef.current = new Set();
    try {
      await api.post('/reading-sessions', { date: localDate(), durationSeconds: seconds, pages });
      qc.invalidateQueries({ queryKey: ['stats-summary'] });
    } catch {
      /* keep counting; next flush retries */
    }
  }

  // reset per-page dwell when the page changes
  useEffect(() => { dwellRef.current = 0; }, [page]);

  // 1s ticker: accumulate active time, mark page read after dwell
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      secondsRef.current += 1;
      dwellRef.current += 1;
      if (dwellRef.current >= PAGE_DWELL_S) pagesRef.current.add(pageRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // periodic flush
  useEffect(() => {
    const id = setInterval(flush, FLUSH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // flush on hide + on unmount
  useEffect(() => {
    const onHide = () => { if (document.hidden) void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); void flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

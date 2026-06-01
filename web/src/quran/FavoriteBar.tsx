import { useFavorites, useToggleFavorite } from '../reading/useFavorites';

export function FavoriteBar({
  selected,
  onClose,
}: {
  selected: { surah: number; ayah: number };
  onClose: () => void;
}) {
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const favorited = !!favorites?.some((f) => f.surah === selected.surah && f.ayah === selected.ayah);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card-light dark:bg-card-dark shadow-lg rounded-full px-4 py-2 flex items-center gap-4">
      <span className="text-sm text-muted">{selected.surah}:{selected.ayah}</span>
      <button
        onClick={() => toggle.mutate({ surah: selected.surah, ayah: selected.ayah, favorited })}
        className={favorited ? 'text-red-500' : 'text-muted'}
        aria-label="Toggle favorite"
      >
        {favorited ? '♥ Favorited' : '♡ Favorite'}
      </button>
      <button onClick={onClose} className="text-muted" aria-label="Close">✕</button>
    </div>
  );
}

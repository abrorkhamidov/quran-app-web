import { Link } from 'react-router-dom';
import { useFavorites } from '../reading/useFavorites';

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8 lg:px-12 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Favorites</h1>
        <p className="mt-1 text-muted">Ayahs you've saved while reading.</p>
      </header>

      {isLoading && <p className="text-muted">Loading…</p>}

      {favorites && favorites.length === 0 && (
        <div className="rounded-3xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark shadow-soft p-12 text-center">
          <p className="text-muted">No favorites yet. Tap an ayah while reading to save it.</p>
        </div>
      )}

      {favorites && favorites.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((f) => (
            <Link
              key={`${f.surah}:${f.ayah}`}
              to={`/read/page/${f.page}`}
              className="rounded-2xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-5 transition hover:shadow-lift hover:-translate-y-0.5"
            >
              <span className="font-display text-xl">Surah {f.surah} · Ayah {f.ayah}</span>
              <p className="mt-1 text-sm text-muted">page {f.page}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

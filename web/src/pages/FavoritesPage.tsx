import { Link } from 'react-router-dom';
import { useFavorites } from '../reading/useFavorites';

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Favorites</h1>
        <span className="w-10" />
      </div>
      {isLoading && <p className="text-muted">Loading…</p>}
      {favorites && favorites.length === 0 && <p className="text-muted text-center">No favorites yet. Tap an ayah while reading to save it.</p>}
      <ul className="space-y-2">
        {favorites?.map((f) => (
          <li key={`${f.surah}:${f.ayah}`}>
            <Link to={`/read/page/${f.page}`} className="block bg-card-light dark:bg-card-dark rounded-xl px-4 py-3 hover:opacity-90">
              <span className="font-medium">Surah {f.surah}, Ayah {f.ayah}</span>
              <span className="text-muted text-sm"> · page {f.page}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

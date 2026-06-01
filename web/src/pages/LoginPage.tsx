import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password');
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-surface-light dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-lift p-8">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-3xl font-semibold tracking-tight">Wird</span>
            <span className="text-xs text-muted">وِرْد</span>
          </div>
          <p className="mt-1 text-sm text-muted">a quiet daily portion</p>
        </div>

        <h1 className="mt-8 font-display text-xl">Welcome back</h1>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <input
            className="w-full rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-soft/40"
            type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="w-full rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-soft/40"
            type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          <button className="w-full rounded-xl bg-accent text-white py-2.5 font-medium hover:opacity-95 transition" type="submit">
            Sign in
          </button>
        </form>

        <p className="mt-5 text-sm text-muted text-center">
          No account? <Link className="text-accent-soft hover:underline" to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

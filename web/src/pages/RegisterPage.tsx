import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await register(email, password, name);
      navigate('/');
    } catch {
      setError('Could not create account (email may be in use, password min 8 chars)');
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-card-light dark:bg-card-dark rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="w-full rounded-lg bg-accent text-white py-2" type="submit">Create account</button>
        <p className="text-sm text-muted">Have an account? <Link className="text-accent-soft" to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}

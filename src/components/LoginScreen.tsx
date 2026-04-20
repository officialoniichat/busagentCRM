import { useState } from 'react';
import { tryLogin } from '../auth';
import type { SessionUser } from '../auth';

interface Props {
  onLogin: (user: SessionUser) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const user = tryLogin(username, password);
    if (!user) {
      setErr('Benutzername oder Passwort falsch');
      return;
    }
    onLogin(user);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-7 space-y-5"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white grid place-items-center font-semibold shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">
              CRM · BusAgent
            </h1>
            <p className="text-xs text-slate-500">Anmeldung erforderlich</p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Benutzername
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Passwort
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
          />
        </label>

        {err && (
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
        >
          Anmelden
        </button>
      </form>
    </div>
  );
}

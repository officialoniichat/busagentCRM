import { useCallback, useEffect, useState } from 'react';
import type { Origin } from './types';

export type Role = 'seller' | 'admin';

export interface SessionUser {
  id: string;
  username: string;
  label: string;
  role: Role;
  origin: Origin | null;
}

interface UserDef extends SessionUser {
  password: string;
}

const USERS: UserDef[] = [
  {
    id: 'fabian',
    username: 'fabian',
    password: 'Fabian022002...',
    label: 'Fabian',
    role: 'seller',
    origin: 'F'
  },
  {
    id: 'theo',
    username: 'theo',
    password: 'Schulzi.9',
    label: 'Theo',
    role: 'seller',
    origin: 'T'
  },
  {
    id: 'daniel',
    username: 'daniel',
    password: 'Daniel123',
    label: 'Daniel',
    role: 'seller',
    origin: 'D'
  },
  {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    label: 'Admin',
    role: 'admin',
    origin: null
  }
];

export function tryLogin(username: string, password: string): SessionUser | null {
  const u = USERS.find(
    (x) =>
      x.username.toLowerCase() === username.trim().toLowerCase() &&
      x.password === password
  );
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    label: u.label,
    role: u.role,
    origin: u.origin
  };
}

const KEY = 'crm.session';

function loadSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (!parsed || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUserState] = useState<SessionUser | null>(() => loadSession());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setUserState(loadSession());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((u: SessionUser) => {
    localStorage.setItem(KEY, JSON.stringify(u));
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setUserState(null);
  }, []);

  return { user, login, logout };
}

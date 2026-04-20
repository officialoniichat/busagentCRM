import { useCallback, useEffect, useState } from 'react';
import type { TabName } from './components/Header';

export interface Route {
  tab: TabName;
  newContact?: boolean;
  contactId?: string;
  newMeeting?: boolean;
  meetingId?: string;
  newTask?: boolean;
  taskId?: string;
}

const VALID_TABS = new Set(['contacts', 'calendar', 'tasks', 'open']);

function parseHash(): Route {
  if (typeof window === 'undefined') return { tab: 'contacts' };
  const h = window.location.hash.replace(/^#\/?/, '');
  if (!h) return { tab: 'contacts' };
  const [path, query = ''] = h.split('?');
  const firstSeg = path.split('/')[0];
  const tab = (VALID_TABS.has(firstSeg) ? firstSeg : 'contacts') as TabName;
  const route: Route = { tab };
  const params = new URLSearchParams(query);

  if (params.get('new') === '1') {
    if (tab === 'contacts') route.newContact = true;
    else if (tab === 'calendar') route.newMeeting = true;
    else if (tab === 'tasks') route.newTask = true;
  }

  const id = params.get('id');
  if (id) {
    if (tab === 'contacts') route.contactId = id;
    else if (tab === 'tasks') route.taskId = id;
  }

  const mid = params.get('meeting');
  if (mid) route.meetingId = mid;

  return route;
}

function buildHash(route: Route): string {
  const p = new URLSearchParams();
  if (route.tab === 'contacts') {
    if (route.newContact) p.set('new', '1');
    else if (route.contactId) p.set('id', route.contactId);
  } else if (route.tab === 'calendar') {
    if (route.newMeeting) p.set('new', '1');
    else if (route.meetingId) p.set('meeting', route.meetingId);
  } else if (route.tab === 'tasks') {
    if (route.newTask) p.set('new', '1');
    else if (route.taskId) p.set('id', route.taskId);
    else if (route.meetingId) p.set('meeting', route.meetingId);
  }
  const qs = p.toString();
  return '#/' + route.tab + (qs ? '?' + qs : '');
}

export function useRoute(): [
  Route,
  (next: Route | ((prev: Route) => Route)) => void
] {
  const [route, setInternalRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onChange = () => setInternalRoute(parseHash());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) {
      history.replaceState(null, '', buildHash({ tab: 'contacts' }));
    }
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  const setRoute = useCallback(
    (next: Route | ((prev: Route) => Route)) => {
      setInternalRoute((prev) => {
        const n = typeof next === 'function' ? next(prev) : next;
        const hash = buildHash(n);
        if (window.location.hash !== hash) {
          history.pushState(null, '', hash);
        }
        return n;
      });
    },
    []
  );

  return [route, setRoute];
}

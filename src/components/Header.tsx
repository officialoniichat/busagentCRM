import type { SyncStatus } from '../types';
import type { SessionUser } from '../auth';

export type TabName = 'contacts' | 'calendar' | 'tasks' | 'open' | 'stats';

interface Props {
  tab: TabName;
  onTabChange: (t: TabName) => void;
  onAddContact: () => void;
  onSync: () => void;
  syncing: boolean;
  status: SyncStatus | null;
  openCount: number;
  user: SessionUser;
  onLogout: () => void;
}

export default function Header({
  tab,
  onTabChange,
  onAddContact,
  onSync,
  syncing,
  status,
  openCount,
  user,
  onLogout
}: Props) {
  const isAdmin = user.role === 'admin';
  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur ring-1 ring-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2 sm:gap-3 flex-none">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-semibold shadow-sm">
            C
          </div>
          <div className="hidden md:block">
            <h1 className="text-base font-semibold leading-tight text-slate-900">
              CRM · BusAgent
            </h1>
            <p className="text-xs text-slate-500">Lokales Kontaktmanagement</p>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-lg p-1 sm:ml-4 overflow-x-auto max-w-full">
          <TabButton active={tab === 'contacts'} onClick={() => onTabChange('contacts')}>
            Kontakte
          </TabButton>
          <TabButton active={tab === 'calendar'} onClick={() => onTabChange('calendar')}>
            Kalender
          </TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => onTabChange('tasks')}>
            Tasks
          </TabButton>
          <TabButton active={tab === 'open'} onClick={() => onTabChange('open')}>
            <span className="flex items-center gap-1 sm:gap-1.5">
              Offen
              {openCount > 0 && (
                <span
                  className={
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ' +
                    (tab === 'open'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-rose-500 text-white')
                  }
                >
                  {openCount}
                </span>
              )}
            </span>
          </TabButton>
          {isAdmin && (
            <TabButton active={tab === 'stats'} onClick={() => onTabChange('stats')}>
              Stats
            </TabButton>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3 flex-none">
          {status?.configured ? (
            <button
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors"
              title={
                status.lastSyncError
                  ? `Letzter Fehler: ${status.lastSyncError}`
                  : lastSync
                  ? `Zuletzt gesynct: ${lastSync}`
                  : 'Noch kein Sync gelaufen'
              }
            >
              <svg
                className={'w-4 h-4 ' + (syncing ? 'animate-spin' : '')}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span className="hidden sm:inline">
                {syncing ? 'Synce…' : lastSync ? `Sync · ${lastSync}` : 'Jetzt syncen'}
              </span>
            </button>
          ) : (
            <span className="hidden sm:inline text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-1.5">
              Zoom nicht konfiguriert
            </span>
          )}

          {tab === 'contacts' && (
            <button
              onClick={onAddContact}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden sm:inline">Kontakt</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 pl-1.5 sm:pl-3 border-l border-slate-200">
            <span
              className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700 hidden sm:inline-flex"
              title={`Eingeloggt als ${user.label}`}
            >
              {user.label}
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Abmelden?')) onLogout();
              }}
              className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Abmelden"
              aria-label="Abmelden"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ' +
        (active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:text-slate-900')
      }
    >
      {children}
    </button>
  );
}

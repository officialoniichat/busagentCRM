import type { SyncStatus } from '../types';

export type TabName = 'contacts' | 'calendar' | 'tasks';

interface Props {
  tab: TabName;
  onTabChange: (t: TabName) => void;
  onAddContact: () => void;
  onSync: () => void;
  syncing: boolean;
  status: SyncStatus | null;
}

export default function Header({
  tab,
  onTabChange,
  onAddContact,
  onSync,
  syncing,
  status
}: Props) {
  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur ring-1 ring-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-semibold shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-900">
              CRM · Busunternehmen
            </h1>
            <p className="text-xs text-slate-500">Lokales Kontaktmanagement</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 ml-4">
          <TabButton active={tab === 'contacts'} onClick={() => onTabChange('contacts')}>
            Kontakte
          </TabButton>
          <TabButton active={tab === 'calendar'} onClick={() => onTabChange('calendar')}>
            Kalender
          </TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => onTabChange('tasks')}>
            Tasks
          </TabButton>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {status?.configured ? (
            <button
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors"
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
              {syncing ? 'Synce…' : lastSync ? `Sync · ${lastSync}` : 'Jetzt syncen'}
            </button>
          ) : (
            <span className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-1.5">
              Zoom nicht konfiguriert
            </span>
          )}

          {tab === 'contacts' && (
            <button
              onClick={onAddContact}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
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
              Kontakt
            </button>
          )}
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
        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
        (active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:text-slate-900')
      }
    >
      {children}
    </button>
  );
}

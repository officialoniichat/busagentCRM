import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, Meeting, Origin } from '../types';
import { MEETING_ORIGINS, ORIGIN_META, meetingState } from '../types';
import { PulseDot, XIcon } from './Icons';

interface Props {
  meeting: Meeting;
  contacts: Contact[];
  allMeetings?: Meeting[];
  onClose: () => void;
  onLink: (contactId: string | null) => Promise<void>;
  onCreateContact: () => void;
  onSetSellers: (sellers: Origin[]) => Promise<void>;
  onDelete?: () => Promise<void>;
  onReschedule?: (input: { startTime: string; duration: number; timezone?: string }) => Promise<void>;
}

export default function MeetingDrawer({
  meeting,
  contacts,
  allMeetings = [],
  onClose,
  onLink,
  onCreateContact,
  onSetSellers,
  onDelete,
  onReschedule
}: Props) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linkedContact = useMemo(
    () => (meeting.contactId ? contacts.find((c) => c.id === meeting.contactId) : null),
    [meeting.contactId, contacts]
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) =>
      (a.name || a.unternehmen || '').localeCompare(b.name || b.unternehmen || '')
    );
    if (!q) return sorted.slice(0, 30);
    return sorted.filter((c) => {
      const hay = [c.name, c.unternehmen, c.email].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 30);
  }, [contacts, search]);

  async function link(cid: string | null) {
    setSaving(true);
    setErr(null);
    try {
      await onLink(cid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const start = meeting.startTime ? new Date(meeting.startTime) : null;
  const end = start
    ? new Date(start.getTime() + (meeting.duration || 30) * 60000)
    : null;
  const state = meetingState(meeting.startTime, meeting.duration);

  return createPortal(
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StateBadge state={state} />
              <span className="text-xs text-slate-400">
                Zoom-Meeting #{meeting.zoomId}
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {meeting.topic || 'Meeting'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500 flex-none"
            aria-label="Schließen"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <section className="bg-slate-50 rounded-lg p-4 space-y-2">
            <DetailRow label="Zeitpunkt">
              {start
                ? start.toLocaleString('de-DE', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '—'}
            </DetailRow>
            <DetailRow label="Dauer">
              {end && start
                ? `${meeting.duration} Minuten (bis ${end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`
                : '—'}
            </DetailRow>
            <DetailRow label="Zeitzone">{meeting.timezone || 'Europe/Berlin'}</DetailRow>
            {meeting.agenda && (
              <DetailRow label="Agenda">
                <span className="whitespace-pre-wrap">{meeting.agenda}</span>
              </DetailRow>
            )}
            {meeting.joinUrl && (
              <DetailRow label="Join">
                <a
                  href={meeting.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-700 hover:text-indigo-900 break-all"
                >
                  {meeting.joinUrl}
                </a>
              </DetailRow>
            )}
          </section>

          {state !== 'past' && meeting.joinUrl && (
            <a
              href={meeting.joinUrl}
              target="_blank"
              rel="noreferrer"
              className={
                'block w-full text-center px-4 py-3 rounded-lg font-medium text-sm shadow-sm transition-colors ' +
                (state === 'running'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700')
              }
            >
              {state === 'running' ? 'Jetzt beitreten' : 'Zoom-Meeting öffnen'}
            </a>
          )}

          <section>
            <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">
              Im Call
            </h3>
            <SellerToggles
              value={meeting.assignedSellers || []}
              onChange={onSetSellers}
            />
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                Zugeordneter Kontakt
              </h3>
              <span className="text-xs text-slate-400">
                {meeting.matchMode === 'auto' && 'automatisch erkannt'}
                {meeting.matchMode === 'manual' && 'manuell zugeordnet'}
                {meeting.matchMode === 'unlinked' && 'nicht verknüpft'}
              </span>
            </div>

            {linkedContact ? (
              <div className="flex items-center gap-3 bg-indigo-50 ring-1 ring-indigo-200 rounded-lg p-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white grid place-items-center font-semibold text-sm">
                  {(linkedContact.name || linkedContact.unternehmen || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {linkedContact.name || linkedContact.unternehmen}
                  </div>
                  {linkedContact.unternehmen && linkedContact.name && (
                    <div className="text-xs text-slate-500 truncate">
                      {linkedContact.unternehmen}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => link(null)}
                  disabled={saving}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded disabled:opacity-50"
                >
                  Lösen
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic bg-slate-50 rounded-lg p-3">
                Noch nicht mit Kontakt verknüpft.
              </div>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                {linkedContact ? 'Anderen Kontakt zuordnen' : 'Kontakt zuordnen'}
              </h3>
              <button
                type="button"
                onClick={onCreateContact}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Neu anlegen
              </button>
            </div>
            <input
              type="search"
              placeholder="Kontakt suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white mb-2"
            />
            <ul className="divide-y divide-slate-100 ring-1 ring-slate-200 rounded-lg max-h-72 overflow-y-auto">
              {matches.length === 0 && (
                <li className="px-3 py-4 text-sm text-slate-500 text-center">
                  Nichts gefunden.
                </li>
              )}
              {matches.map((c) => {
                const isCurrent = c.id === meeting.contactId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => !isCurrent && link(c.id)}
                      disabled={saving || isCurrent}
                      className={
                        'w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ' +
                        (isCurrent
                          ? 'bg-indigo-50 cursor-default'
                          : 'hover:bg-slate-50')
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {c.name || '—'}
                        </div>
                        {c.unternehmen && (
                          <div className="text-xs text-slate-500 truncate">
                            {c.unternehmen}
                          </div>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-medium">
                          Aktuell
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {err && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
              {err}
            </div>
          )}

          {onReschedule && state !== 'past' && (
            <section className="pt-4 border-t border-slate-200">
              <RescheduleSection
                currentStart={meeting.startTime}
                currentDuration={meeting.duration}
                currentTimezone={meeting.timezone}
                otherMeetings={allMeetings.filter((m) => m.id !== meeting.id)}
                onSubmit={async (input) => {
                  setSaving(true);
                  setErr(null);
                  try {
                    await onReschedule(input);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              />
            </section>
          )}

          {onDelete && (
            <section className="pt-4 border-t border-slate-200">
              <DeleteMeetingButton
                meetingTopic={meeting.topic}
                onDelete={async () => {
                  setSaving(true);
                  setErr(null);
                  try {
                    await onDelete();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                    setSaving(false);
                  }
                }}
                disabled={saving}
              />
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RescheduleSection({
  currentStart,
  currentDuration,
  currentTimezone,
  otherMeetings,
  onSubmit,
  disabled
}: {
  currentStart: string | null;
  currentDuration: number;
  currentTimezone?: string;
  otherMeetings: Meeting[];
  onSubmit: (input: { startTime: string; duration: number; timezone?: string }) => Promise<void>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() => toLocalInput(currentStart));
  const [duration, setDuration] = useState(currentDuration || 60);
  const [conflictAcked, setConflictAcked] = useState(false);

  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const conflicts = useMemo(() => {
    if (!when || !Number.isFinite(duration) || duration < 1) return [];
    const newStart = new Date(when).getTime();
    if (!Number.isFinite(newStart)) return [];
    const newEnd = newStart + Math.round(duration) * 60000;
    return otherMeetings.filter((m) => {
      if (!m.startTime) return false;
      const s = Date.parse(m.startTime);
      if (!Number.isFinite(s)) return false;
      const e = s + Math.max(m.duration || 30, 5) * 60000;
      return newStart < e && newEnd > s;
    });
  }, [otherMeetings, when, duration]);

  useEffect(() => {
    setConflictAcked(false);
  }, [when, duration]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="m14 15-3 3 3 3" />
          <path d="M11 18h7" />
        </svg>
        Verschieben
      </button>
    );
  }

  return (
    <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 space-y-3">
      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
        Meeting verschieben
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
        <label className="block">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Neuer Zeitpunkt
          </div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
          />
        </label>
        <label className="block">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Dauer (min)
          </div>
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
          />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        Das Meeting behält seine Zoom-ID und Join-Link — nur Zeit ändert sich. Teilnehmer können mit demselben Link joinen.
      </p>
      {conflicts.length > 0 && (
        <div className="text-xs bg-amber-50 ring-1 ring-amber-300 rounded-lg px-3 py-2 space-y-1">
          <div className="font-medium text-amber-900">
            {conflicts.length === 1
              ? '1 anderes Meeting überschneidet sich:'
              : `${conflicts.length} andere Meetings überschneiden sich:`}
          </div>
          <ul className="space-y-0.5 text-amber-900/90">
            {conflicts.map((m) => {
              const s = m.startTime ? new Date(m.startTime) : null;
              const e = s ? new Date(s.getTime() + (m.duration || 30) * 60000) : null;
              const fmt = (d: Date | null) =>
                d
                  ? d.toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '—';
              return (
                <li key={m.id} className="flex items-center gap-1.5">
                  <span className="tabular-nums">
                    {fmt(s)}–{e ? e.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="truncate">· {m.topic || 'Ohne Titel'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={disabled}
          className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!when || !Number.isFinite(duration) || duration < 1) return;
            if (conflicts.length > 0 && !conflictAcked) {
              setConflictAcked(true);
              return;
            }
            const startTime = when.length === 16 ? `${when}:00` : when;
            await onSubmit({ startTime, duration: Math.round(duration), timezone: currentTimezone });
            setOpen(false);
          }}
          disabled={disabled || !when}
          className={
            'px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 font-medium ' +
            (conflicts.length > 0
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-indigo-600 text-white hover:bg-indigo-700')
          }
        >
          {disabled
            ? 'Speichere…'
            : conflicts.length > 0 && !conflictAcked
            ? 'Trotzdem verschieben?'
            : conflicts.length > 0
            ? 'Trotzdem verschieben'
            : 'Verschieben'}
        </button>
      </div>
    </div>
  );
}

function DeleteMeetingButton({
  meetingTopic,
  onDelete,
  disabled
}: {
  meetingTopic: string;
  onDelete: () => Promise<void>;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        Meeting bei Zoom löschen
      </button>
    );
  }
  return (
    <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 space-y-2">
      <p className="text-sm text-rose-900">
        <strong>„{meetingTopic || 'Dieses Meeting'}"</strong> wird bei Zoom **und** im CRM gelöscht. Teilnehmer verlieren ihre Join-Links. Nicht rückgängig machbar.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
        >
          {disabled ? 'Lösche…' : 'Endgültig löschen'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={disabled}
          className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 text-sm">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider w-24 flex-none pt-0.5">
        {label}
      </span>
      <span className="text-slate-900 flex-1 min-w-0">{children}</span>
    </div>
  );
}

function SellerToggles({
  value,
  onChange
}: {
  value: Origin[];
  onChange: (next: Origin[]) => Promise<void>;
}) {
  const [saving, setSaving] = useState<Origin | null>(null);

  async function toggle(o: Origin) {
    setSaving(o);
    try {
      const has = value.includes(o);
      const next = has ? value.filter((x) => x !== o) : [...value, o];
      await onChange(next);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {MEETING_ORIGINS.map((o) => {
        const meta = ORIGIN_META[o];
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            disabled={saving === o}
            className={
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ring-1 transition-colors disabled:opacity-60 ' +
              (active
                ? meta.chip
                : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300')
            }
          >
            <span
              className={
                'w-4 h-4 rounded border-2 grid place-items-center flex-none ' +
                (active ? 'border-current bg-current' : 'border-slate-300')
              }
            >
              {active && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function StateBadge({ state }: { state: import('../types').MeetingState }) {
  if (state === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300 rounded-full px-2 py-0.5">
        <PulseDot className="w-1.5 h-1.5" />
        Läuft gerade
      </span>
    );
  }
  if (state === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-800 bg-indigo-50 ring-1 ring-indigo-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        Bevorstehend
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 ring-1 ring-slate-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Abgelaufen
    </span>
  );
}

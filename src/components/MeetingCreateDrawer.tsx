import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, Meeting, NewContact, NewMeeting, Origin } from '../types';
import { ORIGIN_META } from '../types';
import { CheckIcon, PlusIcon, XIcon } from './Icons';
import ContactDrawer from './ContactDrawer';

interface Props {
  contacts: Contact[];
  meetings: Meeting[];
  initialStart?: Date | null;
  initialEnd?: Date | null;
  initialContactId?: string | null;
  onClose: () => void;
  onCreate: (input: NewMeeting) => Promise<void>;
  onCreateContact: (input: NewContact) => Promise<Contact>;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function defaultStart(): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export default function MeetingCreateDrawer({
  contacts,
  meetings,
  initialStart,
  initialEnd,
  initialContactId,
  onClose,
  onCreate,
  onCreateContact
}: Props) {
  const [creatingContact, setCreatingContact] = useState(false);
  const initialDate = initialStart || defaultStart();
  const initialDuration = initialEnd && initialStart
    ? Math.max(
        15,
        Math.round((initialEnd.getTime() - initialStart.getTime()) / 60000)
      )
    : 60;

  const [topic, setTopic] = useState('');
  const [when, setWhen] = useState(toLocalInputValue(initialDate));
  const [duration, setDuration] = useState(initialDuration);
  const [agenda, setAgenda] = useState('');
  const [contactId, setContactId] = useState<string | null>(initialContactId || null);
  const [search, setSearch] = useState('');
  const initialContact = initialContactId
    ? contacts.find((c) => c.id === initialContactId) || null
    : null;
  const [assignedSellers, setAssignedSellers] = useState<Origin[]>(
    initialContact ? [initialContact.origin] : []
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linkedContact = useMemo(
    () => (contactId ? contacts.find((c) => c.id === contactId) || null : null),
    [contactId, contacts]
  );

  const conflicts = useMemo(() => {
    if (!when || !Number.isFinite(duration) || duration < 1) return [];
    const newStart = new Date(when).getTime();
    if (!Number.isFinite(newStart)) return [];
    const newEnd = newStart + Math.round(duration) * 60000;
    return meetings.filter((m) => {
      if (!m.startTime) return false;
      const s = Date.parse(m.startTime);
      if (!Number.isFinite(s)) return false;
      const e = s + Math.max(m.duration || 30, 5) * 60000;
      return newStart < e && newEnd > s;
    });
  }, [meetings, when, duration]);

  useEffect(() => {
    setConflictAcknowledged(false);
  }, [when, duration]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) =>
      (a.name || a.unternehmen || '').localeCompare(b.name || b.unternehmen || '')
    );
    if (!q) return sorted.slice(0, 20);
    return sorted
      .filter((c) => {
        const hay = [c.name, c.unternehmen, c.email].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [contacts, search]);

  function toggleSeller(o: Origin) {
    setAssignedSellers((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  }

  function pickContact(c: Contact | null) {
    setContactId(c?.id || null);
    if (c) {
      setAssignedSellers((prev) => (prev.includes(c.origin) ? prev : [...prev, c.origin]));
      if (!topic.trim()) {
        setTopic(
          `BusAgent - Unser Austausch | ${c.name || c.unternehmen || ''}`.trim()
        );
      }
    }
    setSearch('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!topic.trim()) {
      setErr('Thema ist Pflicht');
      return;
    }
    if (!when) {
      setErr('Datum & Uhrzeit sind Pflicht');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setErr('Dauer muss > 0 sein');
      return;
    }
    if (conflicts.length > 0 && !conflictAcknowledged) {
      setConflictAcknowledged(true);
      return;
    }
    setSaving(true);
    try {
      const startTime = when.length === 16 ? `${when}:00` : when;
      await onCreate({
        topic: topic.trim(),
        startTime,
        duration: Math.round(duration),
        timezone: 'Europe/Berlin',
        agenda: agenda.trim() || undefined,
        contactId: contactId || undefined,
        assignedSellers: assignedSellers.length > 0 ? assignedSellers : undefined
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Neues Zoom-Meeting</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Wird direkt in Zoom angelegt · Zeitzone Europe/Berlin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Field label="Thema" required>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. BusAgent - Unser Austausch | Nachname | Schulz"
              className={inputCls}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Wann" required>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Dauer (min)" required>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Beschreibung">
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="optional"
              rows={3}
              className={inputCls}
            />
          </Field>

          <Field label="Vertriebler (nur CRM)" hint="wird nicht an Zoom gesendet">
            <div className="flex items-center gap-2">
              {(['F', 'T'] as Origin[]).map((o) => {
                const meta = ORIGIN_META[o];
                const active = assignedSellers.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleSeller(o)}
                    className={
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ring-1 transition-colors ' +
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
                      {active && <CheckIcon className="w-3 h-3 text-white" />}
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Kontakt zuordnen" hint="optional">
            {linkedContact ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {linkedContact.name || linkedContact.unternehmen || '—'}
                  </div>
                  {linkedContact.unternehmen && linkedContact.name && (
                    <div className="text-xs text-slate-500 truncate">
                      {linkedContact.unternehmen}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => pickContact(null)}
                  className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-rose-50"
                >
                  Entfernen
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="search"
                    placeholder="Kontakt suchen…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    type="button"
                    onClick={() => setCreatingContact(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 hover:bg-indigo-100 whitespace-nowrap"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Neu anlegen
                  </button>
                </div>
                <ul className="divide-y divide-slate-100 ring-1 ring-slate-200 rounded-lg max-h-52 overflow-y-auto">
                  {matches.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-slate-500 text-center">
                      Keine Kontakte gefunden
                    </li>
                  ) : (
                    matches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickContact(c)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50"
                        >
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {c.name || c.unternehmen || '—'}
                          </div>
                          {c.unternehmen && c.name && (
                            <div className="text-xs text-slate-500 truncate">
                              {c.unternehmen}
                            </div>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </Field>

          {conflicts.length > 0 && (
            <div className="text-sm bg-amber-50 ring-1 ring-amber-300 rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="font-medium text-amber-900">
                {conflicts.length === 1
                  ? '1 Meeting überschneidet sich mit diesem Zeitraum:'
                  : `${conflicts.length} Meetings überschneiden sich mit diesem Zeitraum:`}
              </div>
              <ul className="space-y-0.5 text-xs text-amber-900/90">
                {conflicts.map((m) => {
                  const s = m.startTime ? new Date(m.startTime) : null;
                  const e = s
                    ? new Date(s.getTime() + (m.duration || 30) * 60000)
                    : null;
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
                    <li key={m.id} className="flex items-center gap-2">
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

          {err && (
            <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className={
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 ' +
              (conflicts.length > 0
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-700')
            }
          >
            {saving
              ? 'Lege an…'
              : conflicts.length > 0 && !conflictAcknowledged
              ? 'Trotzdem anlegen?'
              : conflicts.length > 0
              ? 'Trotzdem anlegen'
              : 'Meeting anlegen'}
          </button>
        </div>
      </form>

      {creatingContact && (
        <ContactDrawer
          initial={null}
          initialDraft={extractDraftFromTopic(topic)}
          titleOverride="Neuer Kontakt"
          onClose={() => setCreatingContact(false)}
          onSave={async (input) => {
            const created = await onCreateContact(input);
            pickContact(created);
            setCreatingContact(false);
          }}
          onDelete={async () => {}}
        />
      )}
    </div>,
    document.body
  );
}

function extractDraftFromTopic(topic: string): Partial<NewContact> {
  const parts = topic.split('|').map((s) => s.trim()).filter(Boolean);
  const hint: Partial<NewContact> = {};
  if (parts.length >= 3) {
    hint.name = parts[1];
    const last = parts[parts.length - 1];
    const dashIdx = last.indexOf(' - ');
    if (dashIdx !== -1) hint.unternehmen = last.slice(dashIdx + 3).trim();
  } else if (parts.length === 2) {
    hint.name = parts[1];
  }
  if (topic.trim()) {
    hint.notizen = `Angelegt aus neuem Zoom-Meeting „${topic.trim()}"`;
  }
  return hint;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white placeholder:text-slate-400';

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

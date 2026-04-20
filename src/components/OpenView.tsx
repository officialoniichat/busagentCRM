import { useMemo, useState } from 'react';
import type { Contact, Meeting, NewTask, Origin, Stufe, Task } from '../types';
import {
  MEETING_ORIGINS,
  ORIGIN_META,
  STUFE_META,
  meetingState,
  vorschauHighlight
} from '../types';
import { ActivityIcon, CheckIcon, XIcon } from './Icons';

interface Props {
  meetings: Meeting[];
  contacts: Contact[];
  onReview: (
    meetingId: string,
    input: { outcome: 'happened' | 'noshow'; newStufe?: Stufe; note?: string }
  ) => Promise<void>;
  onReschedule: (
    meetingId: string,
    input: { startTime: string; duration: number; timezone?: string }
  ) => Promise<void>;
  onCreateTask: (input: NewTask) => Promise<Task>;
}

export default function OpenView({
  meetings,
  contacts,
  onReview,
  onReschedule,
  onCreateTask
}: Props) {
  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  const pending = useMemo(() => {
    return meetings
      .filter(
        (m) =>
          m.contactId &&
          !m.reviewed &&
          m.startTime &&
          meetingState(m.startTime, m.duration) === 'past'
      )
      .sort((a, b) => {
        const at = a.startTime ? Date.parse(a.startTime) : 0;
        const bt = b.startTime ? Date.parse(b.startTime) : 0;
        return bt - at;
      });
  }, [meetings]);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Offene Nachbereitung</h2>
        <p className="text-sm text-slate-500 mt-1">
          {pending.length === 0
            ? 'Alles sauber. Keine vergangenen Meetings warten auf Review.'
            : `${pending.length} vergangene Meetings warten auf Nachbereitung.`}
        </p>
      </header>

      {pending.length === 0 && (
        <div className="bg-white rounded-xl ring-1 ring-slate-200 py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 ring-1 ring-emerald-200 grid place-items-center">
            <CheckIcon className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-slate-500 text-sm">Nichts offen</p>
        </div>
      )}

      {pending.map((m) => {
        const contact = m.contactId ? contactById.get(m.contactId) : null;
        if (!contact) return null;
        return (
          <ReviewCard
            key={m.id}
            meeting={m}
            contact={contact}
            otherMeetings={meetings.filter((x) => x.id !== m.id)}
            onReview={(input) => onReview(m.id, input)}
            onReschedule={(input) => onReschedule(m.id, input)}
            onCreateTask={onCreateTask}
          />
        );
      })}
    </main>
  );
}

type NoshowMode = 'none' | 'reschedule' | 'task' | 'dismiss';

function ReviewCard({
  meeting,
  contact,
  otherMeetings,
  onReview,
  onReschedule,
  onCreateTask
}: {
  meeting: Meeting;
  contact: Contact;
  otherMeetings: Meeting[];
  onReview: (input: {
    outcome: 'happened' | 'noshow';
    newStufe?: Stufe;
    note?: string;
  }) => Promise<void>;
  onReschedule: (input: { startTime: string; duration: number; timezone?: string }) => Promise<void>;
  onCreateTask: (input: NewTask) => Promise<Task>;
}) {
  const [outcome, setOutcome] = useState<'happened' | 'noshow' | null>(null);
  const [noshowMode, setNoshowMode] = useState<NoshowMode>('none');
  const [newStufe, setNewStufe] = useState<Stufe>(contact.stufe);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reschedule state
  const [rescheduleWhen, setRescheduleWhen] = useState(() => defaultReschedule());
  const [rescheduleDur, setRescheduleDur] = useState(meeting.duration || 60);
  const [conflictAcked, setConflictAcked] = useState(false);

  // Task state
  const [taskOwner, setTaskOwner] = useState<Origin>('F');
  const [taskTitle, setTaskTitle] = useState(
    `Follow-up: ${contact.name || contact.unternehmen || 'Kunde'}`
  );
  const [taskStart, setTaskStart] = useState(() => defaultTaskStart());
  const [taskDur, setTaskDur] = useState(30);

  const start = meeting.startTime ? new Date(meeting.startTime) : null;

  function defaultReschedule() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toLocalInput(d);
  }

  function defaultTaskStart() {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  }

  function toLocalInput(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const rescheduleConflicts = useMemo(() => {
    if (!rescheduleWhen) return [] as Meeting[];
    const s = new Date(rescheduleWhen).getTime();
    if (!Number.isFinite(s)) return [];
    const e = s + Math.max(rescheduleDur || 30, 5) * 60000;
    return otherMeetings.filter((x) => {
      if (!x.startTime) return false;
      const xs = Date.parse(x.startTime);
      if (!Number.isFinite(xs)) return false;
      const xe = xs + Math.max(x.duration || 30, 5) * 60000;
      return s < xe && e > xs;
    });
  }, [otherMeetings, rescheduleWhen, rescheduleDur]);

  async function submitHappened() {
    setSaving(true);
    setErr(null);
    try {
      await onReview({
        outcome: 'happened',
        newStufe: newStufe !== contact.stufe ? newStufe : undefined,
        note: note.trim() || undefined
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function submitDismiss() {
    setSaving(true);
    setErr(null);
    try {
      await onReview({ outcome: 'noshow', note: note.trim() || undefined });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function submitReschedule() {
    if (!rescheduleWhen || !Number.isFinite(rescheduleDur) || rescheduleDur < 1) return;
    if (rescheduleConflicts.length > 0 && !conflictAcked) {
      setConflictAcked(true);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const startTime = rescheduleWhen.length === 16 ? `${rescheduleWhen}:00` : rescheduleWhen;
      await onReschedule({ startTime, duration: Math.round(rescheduleDur) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function submitTask() {
    if (!taskTitle.trim() || !taskStart) return;
    setSaving(true);
    setErr(null);
    try {
      const startIso = new Date(taskStart).toISOString();
      const endIso = new Date(
        new Date(taskStart).getTime() + Math.max(taskDur || 30, 5) * 60000
      ).toISOString();
      await onCreateTask({
        owner: taskOwner,
        title: taskTitle.trim(),
        startAt: startIso,
        endAt: endIso,
        body: `Follow-up aus ausgefallenem Zoom-Call „${meeting.topic}" mit ${contact.name || contact.unternehmen}`
      });
      await onReview({
        outcome: 'noshow',
        note: note.trim() || `Task für ${ORIGIN_META[taskOwner].label} angelegt`
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function reset() {
    setOutcome(null);
    setNoshowMode('none');
    setNote('');
    setNewStufe(contact.stufe);
    setConflictAcked(false);
  }

  const stufeChanged = newStufe !== contact.stufe;
  const vh = vorschauHighlight(contact);
  const cardCls =
    vh === 'needs-files'
      ? 'bg-white rounded-xl ring-1 ring-rose-300 border-l-4 border-rose-500 p-5 space-y-4'
      : vh === 'has-files'
      ? 'bg-white rounded-xl ring-1 ring-emerald-300 border-l-4 border-emerald-500 p-5 space-y-4'
      : 'bg-white rounded-xl ring-1 ring-slate-200 p-5 space-y-4';

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white grid place-items-center font-semibold flex-none">
          {(contact.name || contact.unternehmen || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 truncate">
            {contact.name || contact.unternehmen}
          </div>
          {contact.unternehmen && contact.name && (
            <div className="text-xs text-slate-500 truncate">{contact.unternehmen}</div>
          )}
          <div className="text-sm text-slate-700 mt-2 flex items-center gap-2 flex-wrap">
            <ActivityIcon type="meeting" className="w-3.5 h-3.5 text-indigo-600" />
            <span className="truncate">{meeting.topic || 'Zoom-Meeting'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {start
              ? start.toLocaleString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '—'}
            {' · '}
            {meeting.duration} Min.
            {' · aktuelle Stufe: '}
            <span className="font-medium text-slate-700">{STUFE_META[contact.stufe].label}</span>
          </div>
        </div>
      </div>

      {outcome === null && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOutcome('happened')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ring-1 bg-white text-slate-700 ring-slate-200 hover:ring-emerald-300"
          >
            <CheckIcon className="w-3.5 h-3.5" />
            Call stattgefunden
          </button>
          <button
            type="button"
            onClick={() => setOutcome('noshow')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ring-1 bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"
          >
            <XIcon className="w-3.5 h-3.5" />
            Nicht zustande gekommen
          </button>
        </div>
      )}

      {outcome === 'happened' && (
        <>
          <div className="space-y-2 bg-slate-50 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
              Stufe aktualisieren?
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['K', 'V', 'T'] as Stufe[]).map((s) => {
                const active = newStufe === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewStufe(s)}
                    className={
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ring-1 transition-colors ' +
                      (active ? STUFE_META[s].chip : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
                    }
                  >
                    <span className={'w-1.5 h-1.5 rounded-full ' + STUFE_META[s].dot} />
                    {STUFE_META[s].label}
                    {active && s === contact.stufe && (
                      <span className="text-[10px] opacity-60 ml-1">· aktuell</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <NoteField value={note} onChange={setNote} />
          <Footer
            onReset={reset}
            saving={saving}
            onSubmit={submitHappened}
            submitLabel={stufeChanged ? 'Abschließen + Stufe ändern' : 'Abschließen'}
            hint={
              stufeChanged
                ? `Stufe: ${STUFE_META[contact.stufe].label} → ${STUFE_META[newStufe].label}`
                : 'Stufe bleibt unverändert'
            }
          />
        </>
      )}

      {outcome === 'noshow' && noshowMode === 'none' && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Wie weiter?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ActionTile
              icon="reschedule"
              title="Verschieben"
              desc="Meeting auf neuen Termin schieben (Join-Link bleibt)"
              onClick={() => setNoshowMode('reschedule')}
            />
            <ActionTile
              icon="task"
              title="Task anlegen"
              desc="Follow-up für Vertriebler / ITler"
              onClick={() => setNoshowMode('task')}
            />
            <ActionTile
              icon="dismiss"
              title="Nur abhaken"
              desc="Noshow dokumentieren, nichts weiter"
              onClick={() => setNoshowMode('dismiss')}
            />
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            ← zurück
          </button>
        </div>
      )}

      {outcome === 'noshow' && noshowMode === 'reschedule' && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
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
                value={rescheduleWhen}
                onChange={(e) => {
                  setRescheduleWhen(e.target.value);
                  setConflictAcked(false);
                }}
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
                value={rescheduleDur}
                onChange={(e) => {
                  setRescheduleDur(Number(e.target.value));
                  setConflictAcked(false);
                }}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              />
            </label>
          </div>
          {rescheduleConflicts.length > 0 && (
            <div className="text-xs bg-amber-50 ring-1 ring-amber-300 rounded-lg px-3 py-2 space-y-1">
              <div className="font-medium text-amber-900">
                {rescheduleConflicts.length === 1
                  ? '1 anderes Meeting überschneidet sich:'
                  : `${rescheduleConflicts.length} andere Meetings überschneiden sich:`}
              </div>
              <ul className="space-y-0.5 text-amber-900/90">
                {rescheduleConflicts.slice(0, 5).map((x) => {
                  const xs = x.startTime ? new Date(x.startTime) : null;
                  return (
                    <li key={x.id}>
                      {xs?.toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      · {x.topic || 'Ohne Titel'}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Das Meeting behält Zoom-ID + Join-Link. Es taucht dann nicht mehr in der Offen-Liste auf,
            weil es wieder in der Zukunft liegt.
          </p>
          {err && <ErrorBox msg={err} />}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setNoshowMode('none')}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              ← zurück
            </button>
            <button
              type="button"
              onClick={submitReschedule}
              disabled={saving || !rescheduleWhen}
              className={
                'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60 shadow-sm ' +
                (rescheduleConflicts.length > 0
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700')
              }
            >
              {saving
                ? 'Verschiebe…'
                : rescheduleConflicts.length > 0 && !conflictAcked
                ? 'Trotzdem verschieben?'
                : rescheduleConflicts.length > 0
                ? 'Trotzdem verschieben'
                : 'Verschieben'}
            </button>
          </div>
        </div>
      )}

      {outcome === 'noshow' && noshowMode === 'task' && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-3">
          <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Follow-up-Task anlegen
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Für wen
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {MEETING_ORIGINS.map((o) => {
                const active = taskOwner === o;
                const meta = ORIGIN_META[o];
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setTaskOwner(o)}
                    className={
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ring-1 ' +
                      (active
                        ? meta.chip
                        : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
                    }
                  >
                    <span className="text-[10px] opacity-70">{meta.role}</span>
                    <span className="font-semibold">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
              Titel
            </div>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
            <label className="block">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Start
              </div>
              <input
                type="datetime-local"
                value={taskStart}
                onChange={(e) => setTaskStart(e.target.value)}
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
                value={taskDur}
                onChange={(e) => setTaskDur(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              />
            </label>
          </div>
          <NoteField value={note} onChange={setNote} label="Review-Notiz (optional)" />
          {err && <ErrorBox msg={err} />}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setNoshowMode('none')}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              ← zurück
            </button>
            <button
              type="button"
              onClick={submitTask}
              disabled={saving || !taskTitle.trim() || !taskStart}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium shadow-sm"
            >
              {saving ? 'Speichere…' : 'Task anlegen + Review schließen'}
            </button>
          </div>
        </div>
      )}

      {outcome === 'noshow' && noshowMode === 'dismiss' && (
        <>
          <NoteField value={note} onChange={setNote} />
          <Footer
            onReset={() => setNoshowMode('none')}
            resetLabel="← zurück"
            saving={saving}
            onSubmit={submitDismiss}
            submitLabel="Abschließen"
            hint="Meeting wird als nicht-stattgefunden markiert"
          />
        </>
      )}

      {err && outcome === null && <ErrorBox msg={err} />}
    </div>
  );
}

function ActionTile({
  icon,
  title,
  desc,
  onClick
}: {
  icon: 'reschedule' | 'task' | 'dismiss';
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white ring-1 ring-slate-200 hover:ring-indigo-300 hover:bg-indigo-50/40 rounded-lg p-3 transition-colors"
    >
      <div className="flex items-center gap-2 text-indigo-700 mb-1">
        {icon === 'reschedule' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="m14 15-3 3 3 3" />
            <path d="M11 18h7" />
          </svg>
        )}
        {icon === 'task' && <ActivityIcon type="termin" className="w-4 h-4" />}
        {icon === 'dismiss' && <CheckIcon className="w-4 h-4" />}
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>
      <div className="text-xs text-slate-500 leading-snug">{desc}</div>
    </button>
  );
}

function NoteField({
  value,
  onChange,
  label = 'Notiz zum Call (optional)'
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="optional"
        className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white resize-y"
      />
    </label>
  );
}

function Footer({
  onReset,
  resetLabel = 'Zurücksetzen',
  saving,
  onSubmit,
  submitLabel,
  hint
}: {
  onReset: () => void;
  resetLabel?: string;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-1 gap-3 flex-wrap">
      <div className="text-xs text-slate-500">{hint}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50"
        >
          {resetLabel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium shadow-sm"
        >
          {saving ? 'Speichere…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
      {msg}
    </div>
  );
}

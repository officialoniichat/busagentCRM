import { useMemo, useState } from 'react';
import type { Contact, Meeting, Stufe } from '../types';
import { STUFE_META, meetingState, vorschauHighlight } from '../types';
import { ActivityIcon, CheckIcon, XIcon } from './Icons';

interface Props {
  meetings: Meeting[];
  contacts: Contact[];
  onReview: (
    meetingId: string,
    input: { outcome: 'happened' | 'noshow'; newStufe?: Stufe; note?: string }
  ) => Promise<void>;
}

export default function OpenView({ meetings, contacts, onReview }: Props) {
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
            onReview={(input) => onReview(m.id, input)}
          />
        );
      })}
    </main>
  );
}

function ReviewCard({
  meeting,
  contact,
  onReview
}: {
  meeting: Meeting;
  contact: Contact;
  onReview: (input: {
    outcome: 'happened' | 'noshow';
    newStufe?: Stufe;
    note?: string;
  }) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<'happened' | 'noshow' | null>(null);
  const [newStufe, setNewStufe] = useState<Stufe>(contact.stufe);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = meeting.startTime ? new Date(meeting.startTime) : null;

  async function submit() {
    if (!outcome) {
      setErr('Bitte Ergebnis wählen');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onReview({
        outcome,
        newStufe: outcome === 'happened' && newStufe !== contact.stufe ? newStufe : undefined,
        note: note.trim() || undefined
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
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
            <span className="font-medium text-slate-700">
              {STUFE_META[contact.stufe].label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOutcome('happened')}
          className={
            'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ring-1 transition-colors ' +
            (outcome === 'happened'
              ? 'bg-emerald-600 text-white ring-emerald-600'
              : 'bg-white text-slate-700 ring-slate-200 hover:ring-emerald-300')
          }
        >
          <CheckIcon className="w-3.5 h-3.5" />
          Call stattgefunden
        </button>
        <button
          type="button"
          onClick={() => setOutcome('noshow')}
          className={
            'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ring-1 transition-colors ' +
            (outcome === 'noshow'
              ? 'bg-slate-700 text-white ring-slate-700'
              : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400')
          }
        >
          <XIcon className="w-3.5 h-3.5" />
          Nicht zustande gekommen
        </button>
      </div>

      {outcome === 'happened' && (
        <div className="space-y-2 bg-slate-50 rounded-lg p-3">
          <label className="block">
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
              Stufe aktualisieren?
            </div>
            <div className="flex items-center gap-2">
              {(['K', 'V', 'T'] as Stufe[]).map((s) => {
                const active = newStufe === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewStufe(s)}
                    className={
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ring-1 transition-colors ' +
                      (active
                        ? STUFE_META[s].chip
                        : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
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
          </label>
        </div>
      )}

      {outcome && (
        <div>
          <label className="block">
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
              Notiz zum Call (optional)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="z.B. Interesse an Linie + Anmiet, Angebot schicken"
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white resize-y"
            />
          </label>
        </div>
      )}

      {err && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {outcome && (
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            {outcome === 'happened' && stufeChanged && (
              <>Stufe: {STUFE_META[contact.stufe].label} → <strong>{STUFE_META[newStufe].label}</strong></>
            )}
            {outcome === 'happened' && !stufeChanged && 'Stufe bleibt unverändert'}
            {outcome === 'noshow' && 'Meeting als nicht-stattgefunden markieren'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOutcome(null);
                setNote('');
                setNewStufe(contact.stufe);
              }}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Zurücksetzen
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium shadow-sm"
            >
              {saving ? 'Speichere…' : 'Review abschließen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

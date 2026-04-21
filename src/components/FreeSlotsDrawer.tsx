import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, Meeting, Origin } from '../types';
import { MEETING_ORIGINS, ORIGIN_META } from '../types';
import { CheckIcon, XIcon } from './Icons';

interface Props {
  meetings: Meeting[];
  contacts: Contact[];
  onClose: () => void;
  onPickSlot: (start: Date, end: Date) => void;
}

interface FreeSlot {
  start: Date;
  end: Date;
  durationMin: number;
  dayKey: string;
  beforeMeeting: Meeting | null;
  afterMeeting: Meeting | null;
  beforeContact: Contact | null;
  beforeIsFirstVorschauFuture: boolean;
}

const DEFAULT_BIZ_START = 9;
const DEFAULT_BIZ_END = 18;

export default function FreeSlotsDrawer({ meetings, contacts, onClose, onPickSlot }: Props) {
  const [daysAhead, setDaysAhead] = useState(14);
  const [minMinutes, setMinMinutes] = useState(30);
  const [maxMinutes, setMaxMinutes] = useState<number | ''>('');
  const [bizStart, setBizStart] = useState(DEFAULT_BIZ_START);
  const [bizEnd, setBizEnd] = useState(DEFAULT_BIZ_END);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [requiredSellers, setRequiredSellers] = useState<Origin[]>([]);
  const [onlyBetween, setOnlyBetween] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slots = useMemo(() => {
    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDay = new Date(startDay.getTime() + daysAhead * 86_400_000);
    return computeFreeSlots({
      meetings,
      contacts,
      from: startDay,
      to: endDay,
      bizStart,
      bizEnd,
      minMinutes,
      maxMinutes: maxMinutes === '' ? null : Number(maxMinutes),
      skipWeekends,
      onlyBetween,
      requiredSellers: requiredSellers.length > 0 ? requiredSellers : null
    });
  }, [
    meetings,
    contacts,
    daysAhead,
    bizStart,
    bizEnd,
    minMinutes,
    maxMinutes,
    skipWeekends,
    onlyBetween,
    requiredSellers
  ]);

  const groupedByDay = useMemo(() => {
    const m = new Map<string, FreeSlot[]>();
    for (const s of slots) {
      if (!m.has(s.dayKey)) m.set(s.dayKey, []);
      m.get(s.dayKey)!.push(s);
    }
    return [...m.entries()];
  }, [slots]);

  function toggleSeller(o: Origin) {
    setRequiredSellers((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Freie Zeitfenster</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lücken zwischen Meetings in Geschäftszeit · {slots.length} gefunden
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 space-y-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
              Zeitraum & Geschäftszeit
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-[10px] text-slate-500 block mb-0.5">Nächste Tage</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(Math.max(1, Number(e.target.value) || 1))}
                  className={inputSmall}
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-slate-500 block mb-0.5">Biz Start (h)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={bizStart}
                  onChange={(e) => setBizStart(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                  className={inputSmall}
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-slate-500 block mb-0.5">Biz Ende (h)</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={bizEnd}
                  onChange={(e) => setBizEnd(Math.max(1, Math.min(24, Number(e.target.value) || 24)))}
                  className={inputSmall}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
              Freizeit-Dauer
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] text-slate-500 block mb-0.5">Min (min)</span>
                <input
                  type="number"
                  min={1}
                  step={5}
                  value={minMinutes}
                  onChange={(e) => setMinMinutes(Math.max(1, Number(e.target.value) || 1))}
                  className={inputSmall}
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-slate-500 block mb-0.5">Max (min, leer = ∞)</span>
                <input
                  type="number"
                  min={1}
                  step={5}
                  value={maxMinutes}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMaxMinutes(v === '' ? '' : Math.max(1, Number(v) || 1));
                  }}
                  placeholder="keine Grenze"
                  className={inputSmall}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
              Wer muss frei sein?
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MEETING_ORIGINS.map((o) => {
                const active = requiredSellers.includes(o);
                const meta = ORIGIN_META[o];
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleSeller(o)}
                    className={
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ring-1 ' +
                      (active ? meta.chip : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
                    }
                  >
                    <span className={
                      'w-3.5 h-3.5 rounded border-2 grid place-items-center flex-none ' +
                      (active ? 'border-current bg-current' : 'border-slate-300')
                    }>
                      {active && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-[10px] opacity-70">{meta.role}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Leer = nur Meetings ohne „Im Call"-Zuordnung werden als belegend gezählt (niemand
              bestimmt). Mit Auswahl: nur Meetings, wo mind. einer der gewählten drin ist, blockieren.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyBetween}
                onChange={(e) => setOnlyBetween(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Nur Lücken <strong>zwischen</strong> Meetings (keine Randzeit)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Wochenenden überspringen
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {groupedByDay.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-10">
              Keine freien Fenster mit diesen Filtern. Min senken oder Zeitraum erweitern.
            </div>
          )}
          {groupedByDay.map(([dayKey, daySlots]) => (
            <section key={dayKey} className="mb-4 last:mb-0">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 sticky top-0 bg-white py-1">
                {formatDayHeader(dayKey)}
              </div>
              <ul className="space-y-1.5">
                {daySlots.map((s, i) => (
                  <li key={i}>
                    {s.beforeIsFirstVorschauFuture && s.beforeContact && (
                      <div className="bg-rose-50 ring-1 ring-rose-200 rounded-t-lg px-3 py-1.5 text-[11px] text-rose-800 flex items-center gap-1.5">
                        <span className="font-semibold uppercase tracking-wider text-[9px] bg-rose-600 text-white rounded px-1 py-0.5">
                          DAVOR
                        </span>
                        <span className="truncate">
                          <strong>
                            {s.beforeContact.name || s.beforeContact.unternehmen || '—'}
                          </strong>{' '}
                          · erster Termin · Vorschau
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onPickSlot(s.start, s.end)}
                      className={
                        'w-full text-left bg-emerald-50 ring-1 ring-emerald-200 hover:ring-emerald-400 hover:bg-emerald-100 rounded-lg px-3 py-2 transition-colors flex items-center gap-3 ' +
                        (s.beforeIsFirstVorschauFuture ? 'rounded-t-none' : '')
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-emerald-900 tabular-nums">
                          {fmtTime(s.start)}–{fmtTime(s.end)}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {formatDuration(s.durationMin)} frei
                          {s.beforeMeeting && s.afterMeeting && (
                            <span className="text-emerald-600/80">
                              {' '}
                              · zwischen {fmtTime(new Date(Date.parse(s.beforeMeeting.startTime!) + (s.beforeMeeting.duration || 0) * 60_000))} und{' '}
                              {fmtTime(new Date(Date.parse(s.afterMeeting.startTime!)))}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-emerald-700 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
          Klick auf Slot → „Neues Meeting"-Drawer mit Zeit vorbefüllt.
        </div>
      </div>
    </div>,
    document.body
  );
}

const inputSmall =
  'w-full px-2.5 py-1.5 rounded-md ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white';

function fmtTime(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(min: number) {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDayHeader(dayKey: string) {
  const d = new Date(dayKey + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (toKey(d) === toKey(today)) return 'Heute';
  if (toKey(d) === toKey(tomorrow)) return 'Morgen';
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });
}

function toKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function computeFreeSlots(opts: {
  meetings: Meeting[];
  contacts: Contact[];
  from: Date;
  to: Date;
  bizStart: number;
  bizEnd: number;
  minMinutes: number;
  maxMinutes: number | null;
  skipWeekends: boolean;
  onlyBetween: boolean;
  requiredSellers: Origin[] | null;
}): FreeSlot[] {
  const {
    meetings,
    contacts,
    from,
    to,
    bizStart,
    bizEnd,
    minMinutes,
    maxMinutes,
    skipWeekends,
    onlyBetween,
    requiredSellers
  } = opts;
  if (bizEnd <= bizStart) return [];

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const now = new Date();
  const nowMs = now.getTime();

  // Precompute per contactId: earliest future meeting with contact in Vorschau
  const firstFutureVorschauByContact = new Map<string, number>();
  for (const m of meetings) {
    if (!m.startTime || !m.contactId) continue;
    const c = contactById.get(m.contactId);
    if (!c || c.stufe !== 'V') continue;
    const s = Date.parse(m.startTime);
    if (!Number.isFinite(s) || s < nowMs) continue;
    const prev = firstFutureVorschauByContact.get(m.contactId);
    if (prev === undefined || s < prev) {
      firstFutureVorschauByContact.set(m.contactId, s);
    }
  }

  function isFirstVorschauFuture(m: Meeting): boolean {
    if (!m.contactId || !m.startTime) return false;
    const c = contactById.get(m.contactId);
    if (!c || c.stufe !== 'V') return false;
    const s = Date.parse(m.startTime);
    if (!Number.isFinite(s) || s < nowMs) return false;
    const first = firstFutureVorschauByContact.get(m.contactId);
    return first === s;
  }

  // Meetings that "block" per required-sellers filter
  const blocking = meetings.filter((m) => {
    if (!m.startTime || !m.duration) return false;
    if (!requiredSellers) return true;
    const involved = m.assignedSellers || [];
    return involved.some((s) => requiredSellers.includes(s as Origin));
  });

  const slots: FreeSlot[] = [];
  const dayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dayCount = Math.ceil((to.getTime() - dayStart.getTime()) / 86_400_000);

  for (let i = 0; i < dayCount; i++) {
    const day = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + i);
    const dow = day.getDay();
    if (skipWeekends && (dow === 0 || dow === 6)) continue;
    const dayOpen = new Date(day);
    dayOpen.setHours(bizStart, 0, 0, 0);
    const dayClose = new Date(day);
    dayClose.setHours(bizEnd, 0, 0, 0);
    const cursor = nowMs > dayOpen.getTime() && nowMs < dayClose.getTime() ? new Date(nowMs) : dayOpen;
    const effectiveStart = cursor > dayOpen ? cursor : dayOpen;

    // Build list of {start, end, meeting?} for meetings overlapping this day, preserving
    // original meeting refs so we can attach "before / after" to slots.
    const todays: { start: number; end: number; meetings: Meeting[] }[] = [];
    for (const m of blocking) {
      const s = Date.parse(m.startTime!);
      if (!Number.isFinite(s)) continue;
      const e = s + Math.max(m.duration || 30, 5) * 60_000;
      if (e <= dayOpen.getTime() || s >= dayClose.getTime()) continue;
      todays.push({
        start: Math.max(s, dayOpen.getTime()),
        end: Math.min(e, dayClose.getTime()),
        meetings: [m]
      });
    }
    todays.sort((a, b) => a.start - b.start);

    // Merge overlapping/back-to-back blocks (but preserve meeting list)
    const merged: { start: number; end: number; meetings: Meeting[] }[] = [];
    for (const t of todays) {
      const last = merged[merged.length - 1];
      if (last && t.start <= last.end) {
        last.end = Math.max(last.end, t.end);
        last.meetings.push(...t.meetings);
      } else {
        merged.push({ start: t.start, end: t.end, meetings: [...t.meetings] });
      }
    }

    function lastMeeting(block: { meetings: Meeting[] }): Meeting | null {
      if (!block.meetings.length) return null;
      return block.meetings.reduce((latest, m) => {
        const lm = latest.startTime ? Date.parse(latest.startTime) : 0;
        const mm = m.startTime ? Date.parse(m.startTime) : 0;
        return mm > lm ? m : latest;
      });
    }
    function firstMeeting(block: { meetings: Meeting[] }): Meeting | null {
      if (!block.meetings.length) return null;
      return block.meetings.reduce((earliest, m) => {
        const em = earliest.startTime ? Date.parse(earliest.startTime) : 0;
        const mm = m.startTime ? Date.parse(m.startTime) : 0;
        return mm < em ? m : earliest;
      });
    }

    // Edge slot: beginning of business hours to first block
    if (!onlyBetween && merged.length > 0 && merged[0].start > effectiveStart.getTime()) {
      pushSlot(slots, effectiveStart.getTime(), merged[0].start, minMinutes, maxMinutes, null, firstMeeting(merged[0]), null, isFirstVorschauFuture);
    }
    // Gaps between consecutive meeting-blocks
    for (let k = 0; k < merged.length - 1; k++) {
      const a = merged[k];
      const b = merged[k + 1];
      if (b.start > a.end) {
        const beforeM = lastMeeting(a);
        const afterM = firstMeeting(b);
        pushSlot(
          slots,
          a.end,
          b.start,
          minMinutes,
          maxMinutes,
          beforeM,
          afterM,
          beforeM ? contactById.get(beforeM.contactId || '') ?? null : null,
          isFirstVorschauFuture
        );
      }
    }
    // Edge slot: after last block to end of business hours
    if (!onlyBetween && merged.length > 0) {
      const last = merged[merged.length - 1];
      if (last.end < dayClose.getTime()) {
        const beforeM = lastMeeting(last);
        pushSlot(
          slots,
          last.end,
          dayClose.getTime(),
          minMinutes,
          maxMinutes,
          beforeM,
          null,
          beforeM ? contactById.get(beforeM.contactId || '') ?? null : null,
          isFirstVorschauFuture
        );
      }
    }
    // Completely empty day (only in "all gaps" mode)
    if (!onlyBetween && merged.length === 0) {
      pushSlot(slots, effectiveStart.getTime(), dayClose.getTime(), minMinutes, maxMinutes, null, null, null, isFirstVorschauFuture);
    }
  }

  return slots;
}

function pushSlot(
  slots: FreeSlot[],
  startMs: number,
  endMs: number,
  minMinutes: number,
  maxMinutes: number | null,
  beforeMeeting: Meeting | null,
  afterMeeting: Meeting | null,
  beforeContact: Contact | null,
  isFirstVorschauFuture: (m: Meeting) => boolean
) {
  const dur = Math.floor((endMs - startMs) / 60_000);
  if (dur < minMinutes) return;
  if (maxMinutes !== null && dur > maxMinutes) return;
  const s = new Date(startMs);
  const e = new Date(endMs);
  slots.push({
    start: s,
    end: e,
    durationMin: dur,
    dayKey: toKey(s),
    beforeMeeting,
    afterMeeting,
    beforeContact,
    beforeIsFirstVorschauFuture: beforeMeeting ? isFirstVorschauFuture(beforeMeeting) : false
  });
}

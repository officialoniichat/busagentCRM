import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from 'recharts';
import type { Contact, Meeting, Origin, Stufe, Task } from '../types';
import { ORIGIN_META, meetingState, vorschauHighlight } from '../types';

interface Props {
  contacts: Contact[];
  meetings: Meeting[];
  tasks: Task[];
}

const SELLER_COLORS: Record<Origin, string> = {
  F: '#4f46e5',
  T: '#e11d48',
  D: '#0891b2'
};

export default function StatsView({ contacts, meetings, tasks }: Props) {
  const stats = useMemo(() => computeStats(contacts, meetings, tasks), [contacts, meetings, tasks]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Performance-Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Vergleich Fabian vs. Theo · Live aus Firestore
        </p>
      </header>

      {/* Headline Kennzahlen */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Meetings gesamt" value={stats.meetingsTotal} />
        <Kpi label="Kontakte gesamt" value={stats.contactsTotal} />
        <Kpi
          label="Tasks erledigt"
          value={stats.tasksDoneTotal}
          sub={`${stats.tasksTotal} gesamt`}
        />
        <Kpi
          label="Verschobene Meetings"
          value={stats.rescheduledTotal}
          sub={`${stats.noshowTotal} ausgefallen`}
        />
      </section>

      {/* Kunden-Pool Kurve */}
      <Card title="Kunden-Pool pro Vertriebler — monatlich, kumulativ">
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Durchgezogene Linie: <strong>gesamter Kundenpool</strong> (Kontakte mit
          dieser Origin, bis Monatsende angelegt). Gestrichelt:{' '}
          <strong>davon mit mindestens einem Zoom-Meeting</strong>. Abstand zwischen
          beiden Linien = Pool-Kunden ohne bisherigen Meeting-Kontakt.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PoolChart data={stats.monthlyPool} origin="F" />
          <PoolChart data={stats.monthlyPool} origin="T" />
        </div>
      </Card>

      {/* Stufen-Breakdown Gesamt */}
      <Card title="Stufen-Verteilung aller Zoom-Kontakte">
        <StufenBar stats={stats} />
      </Card>

      {/* F vs T vergleich */}
      <Card title="Fabian vs. Theo — direkter Vergleich">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SellerScorecard origin="F" s={stats.perSeller.F} compareTo={stats.perSeller.T} />
          <SellerScorecard origin="T" s={stats.perSeller.T} compareTo={stats.perSeller.F} />
        </div>
      </Card>

      {/* Meetings über Zeit */}
      <Card title="Meetings pro Woche — nach Kunden-Origin">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.weeklyMeetings}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Fabian" stroke={SELLER_COLORS.F} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Theo" stroke={SELLER_COLORS.T} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Verschiebungen & Noshows pro Vertriebler */}
      <Card title="Verschiebungen & Ausfälle">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.reliabilityBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Fabian" fill={SELLER_COLORS.F} />
              <Bar dataKey="Theo" fill={SELLER_COLORS.T} />
              <Bar dataKey="Daniel" fill={SELLER_COLORS.D} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          „Verschoben durch" zählt, wer die Verschiebungs-Aktion durchgeführt hat (jeder Reschedule).
          „Kunde verschoben" / „Kunde ausgefallen" zählt nach Ursprungs-Vertriebler des Kontakts.
        </div>
      </Card>

      {/* Tasks-Bilanz */}
      <Card title="Tasks — wer erledigt am meisten">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.tasksBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="person" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Erledigt" fill="#10b981" />
              <Bar dataKey="Offen" fill="#94a3b8" />
              <Bar dataKey="Überfällig" fill="#e11d48" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Vorschau-Risiko */}
      <Card title="Vorschau-Kunden ohne Dokumente (Risiko)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['F', 'T'] as Origin[]).map((o) => {
            const s = stats.perSeller[o];
            return (
              <div key={o} className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  {ORIGIN_META[o].label}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-rose-600 tabular-nums">
                    {s.vorschauNeedsFiles}
                  </span>
                  <span className="text-sm text-slate-500">
                    / {s.vorschauTotal} Vorschau-Kunden ohne Docs
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {s.vorschauHasFiles} haben Docs hochgeladen (
                  {s.vorschauTotal > 0
                    ? Math.round((s.vorschauHasFiles / s.vorschauTotal) * 100)
                    : 0}
                  %)
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}

function PoolChart({
  data,
  origin
}: {
  data: Array<{
    month: string;
    FabianPool: number;
    FabianMeeting: number;
    TheoPool: number;
    TheoMeeting: number;
  }>;
  origin: 'F' | 'T';
}) {
  const color = SELLER_COLORS[origin];
  const meta = ORIGIN_META[origin];
  const poolKey = origin === 'F' ? 'FabianPool' : 'TheoPool';
  const mtgKey = origin === 'F' ? 'FabianMeeting' : 'TheoMeeting';
  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {meta.label}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey={poolKey}
              name="Pool gesamt"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={mtgKey}
              name="mit Meeting"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl ring-1 ring-slate-200 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4">
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums mt-1">
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StufenBar({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const data = [
    { name: 'Kalt', F: stats.perSeller.F.byStufe.K, T: stats.perSeller.T.byStufe.K, color: '#94a3b8' },
    { name: 'Vorschau', F: stats.perSeller.F.byStufe.V, T: stats.perSeller.T.byStufe.V, color: '#f59e0b' },
    { name: 'Testtermin', F: stats.perSeller.F.byStufe.T, T: stats.perSeller.T.byStufe.T, color: '#10b981' }
  ];
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="F" name="Fabian" fill={SELLER_COLORS.F} />
          <Bar dataKey="T" name="Theo" fill={SELLER_COLORS.T} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SellerScorecard({
  origin,
  s,
  compareTo
}: {
  origin: Origin;
  s: SellerStats;
  compareTo: SellerStats;
}) {
  const meta = ORIGIN_META[origin];
  function pct(a: number, b: number) {
    if (b === 0) return a > 0 ? '+∞' : '±0';
    const p = ((a - b) / b) * 100;
    if (Math.abs(p) < 0.5) return '±0%';
    return (p > 0 ? '+' : '') + p.toFixed(0) + '%';
  }
  function Row({
    label,
    value,
    compareValue,
    goodIsHigh = true
  }: {
    label: string;
    value: number;
    compareValue: number;
    goodIsHigh?: boolean;
  }) {
    const delta = value - compareValue;
    const isGood = goodIsHigh ? delta >= 0 : delta <= 0;
    const deltaStr = pct(value, compareValue);
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular-nums text-slate-900">{value}</span>
          {compareValue !== value && (
            <span
              className={
                'text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded ' +
                (isGood
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200')
              }
            >
              {deltaStr}
            </span>
          )}
        </span>
      </div>
    );
  }
  return (
    <div className={'rounded-xl ring-1 p-4 ' + meta.chip}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg font-semibold text-slate-900">{meta.label}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{meta.role}</span>
      </div>
      <Row label="Kontakte gesamt" value={s.contacts} compareValue={compareTo.contacts} />
      <Row
        label="Meetings (Kunden-Origin)"
        value={s.meetingsByOrigin}
        compareValue={compareTo.meetingsByOrigin}
      />
      <Row
        label="Meetings (als Teilnehmer)"
        value={s.meetingsAsParticipant}
        compareValue={compareTo.meetingsAsParticipant}
      />
      <Row label="Kunde im Testtermin" value={s.byStufe.T} compareValue={compareTo.byStufe.T} />
      <Row
        label="Vorschau ohne Docs"
        value={s.vorschauNeedsFiles}
        compareValue={compareTo.vorschauNeedsFiles}
        goodIsHigh={false}
      />
      <Row
        label="Meetings verschoben"
        value={s.meetingsRescheduled}
        compareValue={compareTo.meetingsRescheduled}
        goodIsHigh={false}
      />
      <Row
        label="Meetings ausgefallen"
        value={s.meetingsNoshow}
        compareValue={compareTo.meetingsNoshow}
        goodIsHigh={false}
      />
      <Row label="Tasks erledigt" value={s.tasksDone} compareValue={compareTo.tasksDone} />
      <Row
        label="Verschoben durch"
        value={s.performedReschedules}
        compareValue={compareTo.performedReschedules}
      />
    </div>
  );
}

interface SellerStats {
  contacts: number;
  /** Meetings wo der verknüpfte Kontakt diesen Vertriebler als Origin hat */
  meetingsByOrigin: number;
  /** Meetings wo dieser Vertriebler als Teilnehmer (assignedSellers) eingetragen ist */
  meetingsAsParticipant: number;
  byStufe: Record<Stufe, number>;
  vorschauTotal: number;
  vorschauHasFiles: number;
  vorschauNeedsFiles: number;
  meetingsRescheduled: number;
  meetingsNoshow: number;
  performedReschedules: number;
  tasksTotal: number;
  tasksDone: number;
  tasksOpen: number;
  tasksOverdue: number;
}

function emptySellerStats(): SellerStats {
  return {
    contacts: 0,
    meetingsByOrigin: 0,
    meetingsAsParticipant: 0,
    byStufe: { K: 0, V: 0, T: 0 },
    vorschauTotal: 0,
    vorschauHasFiles: 0,
    vorschauNeedsFiles: 0,
    meetingsRescheduled: 0,
    meetingsNoshow: 0,
    performedReschedules: 0,
    tasksTotal: 0,
    tasksDone: 0,
    tasksOpen: 0,
    tasksOverdue: 0
  };
}

function computeStats(contacts: Contact[], meetings: Meeting[], tasks: Task[]) {
  const perSeller: Record<Origin, SellerStats> = {
    F: emptySellerStats(),
    T: emptySellerStats(),
    D: emptySellerStats()
  };
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  for (const c of contacts) {
    perSeller[c.origin].contacts += 1;
    perSeller[c.origin].byStufe[c.stufe] += 1;
    if (c.stufe === 'V') {
      perSeller[c.origin].vorschauTotal += 1;
      const vh = vorschauHighlight(c);
      if (vh === 'has-files') perSeller[c.origin].vorschauHasFiles += 1;
      else perSeller[c.origin].vorschauNeedsFiles += 1;
    }
  }

  let rescheduledTotal = 0;
  let noshowTotal = 0;
  let meetingsWithOrigin = 0;
  let meetingsWithoutOrigin = 0;

  for (const m of meetings) {
    if (m.contactId) {
      const contact = contactById.get(m.contactId);
      if (contact) {
        meetingsWithOrigin += 1;
        perSeller[contact.origin].meetingsByOrigin += 1;
        const wasRescheduled = (m.rescheduleHistory?.length || 0) > 0;
        if (wasRescheduled) perSeller[contact.origin].meetingsRescheduled += 1;
        if (m.reviewOutcome === 'noshow') perSeller[contact.origin].meetingsNoshow += 1;
      } else {
        meetingsWithoutOrigin += 1;
      }
    } else {
      meetingsWithoutOrigin += 1;
    }

    for (const s of m.assignedSellers || []) {
      if (s === 'F' || s === 'T' || s === 'D') {
        perSeller[s].meetingsAsParticipant += 1;
      }
    }

    if (m.rescheduleHistory) {
      for (const ev of m.rescheduleHistory) {
        if (ev.by === 'F' || ev.by === 'T' || ev.by === 'D') {
          perSeller[ev.by].performedReschedules += 1;
        }
      }
      rescheduledTotal += m.rescheduleHistory.length;
    }
    if (m.reviewOutcome === 'noshow') noshowTotal += 1;
  }

  const now = Date.now();
  let tasksDoneTotal = 0;
  for (const t of tasks) {
    const s = perSeller[t.owner];
    if (!s) continue;
    s.tasksTotal += 1;
    if (t.done) {
      s.tasksDone += 1;
      tasksDoneTotal += 1;
    } else {
      s.tasksOpen += 1;
      if (t.endAt && Date.parse(t.endAt) < now) s.tasksOverdue += 1;
    }
  }

  // Weekly line-chart data (last 12 weeks)
  const weeksBack = 12;
  const msWeek = 7 * 24 * 3600 * 1000;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weeklyMeetings: { week: string; Fabian: number; Theo: number }[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const wStart = weekStart.getTime() - i * msWeek;
    const wEnd = wStart + msWeek;
    let F = 0;
    let T = 0;
    for (const m of meetings) {
      if (!m.startTime || !m.contactId) continue;
      const ts = Date.parse(m.startTime);
      if (ts < wStart || ts >= wEnd) continue;
      const c = contactById.get(m.contactId);
      if (!c) continue;
      if (c.origin === 'F') F += 1;
      else if (c.origin === 'T') T += 1;
    }
    const d = new Date(wStart);
    weeklyMeetings.push({
      week: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      Fabian: F,
      Theo: T
    });
  }

  const reliabilityBars = [
    {
      category: 'Verschoben durch',
      Fabian: perSeller.F.performedReschedules,
      Theo: perSeller.T.performedReschedules,
      Daniel: perSeller.D.performedReschedules
    },
    {
      category: 'Kunde ausgefallen',
      Fabian: perSeller.F.meetingsNoshow,
      Theo: perSeller.T.meetingsNoshow,
      Daniel: 0
    },
    {
      category: 'Meetings verschoben',
      Fabian: perSeller.F.meetingsRescheduled,
      Theo: perSeller.T.meetingsRescheduled,
      Daniel: 0
    }
  ];

  const tasksBars = (['F', 'T', 'D'] as Origin[]).map((o) => ({
    person: ORIGIN_META[o].label,
    Erledigt: perSeller[o].tasksDone,
    Offen: perSeller[o].tasksOpen,
    Überfällig: perSeller[o].tasksOverdue
  }));

  const upcomingMeetings = meetings.filter(
    (m) => m.startTime && meetingState(m.startTime, m.duration) !== 'past'
  ).length;

  // Monthly contact-pool curve (cumulative) — per origin, and "mit Meeting"
  const contactMeetingFirst = new Map();
  for (const m of meetings) {
    if (!m.contactId || !m.startTime) continue;
    const t = Date.parse(m.startTime);
    if (!Number.isFinite(t)) continue;
    const prev = contactMeetingFirst.get(m.contactId);
    if (prev === undefined || t < prev) contactMeetingFirst.set(m.contactId, t);
  }
  const today = new Date();
  const monthsBack = 12;
  const firstMonth = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);
  const monthlyPool: {
    month: string;
    FabianPool: number;
    FabianMeeting: number;
    TheoPool: number;
    TheoMeeting: number;
  }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const m = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
    const eom = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const label = m.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    let FabianPool = 0,
      FabianMeeting = 0,
      TheoPool = 0,
      TheoMeeting = 0;
    for (const c of contacts) {
      if ((c.createdAt || 0) > eom) continue;
      const firstMtg = contactMeetingFirst.get(c.id);
      const hasMtgByNow = firstMtg !== undefined && firstMtg <= eom;
      if (c.origin === 'F') {
        FabianPool += 1;
        if (hasMtgByNow) FabianMeeting += 1;
      } else if (c.origin === 'T') {
        TheoPool += 1;
        if (hasMtgByNow) TheoMeeting += 1;
      }
    }
    monthlyPool.push({ month: label, FabianPool, FabianMeeting, TheoPool, TheoMeeting });
  }

  return {
    meetingsTotal: meetings.length,
    meetingsWithOrigin,
    meetingsWithoutOrigin,
    contactsTotal: contacts.length,
    tasksTotal: tasks.length,
    tasksDoneTotal,
    upcomingMeetings,
    rescheduledTotal,
    noshowTotal,
    perSeller,
    weeklyMeetings,
    monthlyPool,
    reliabilityBars,
    tasksBars
  };
}

export type { SellerStats };

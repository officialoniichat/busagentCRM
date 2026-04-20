import { useEffect, useMemo, useState } from 'react';
import type { ActivityType, Contact, Meeting, NewContact, Origin, Stufe } from '../types';
import { ORIGIN_META, STUFE_META, meetingState } from '../types';
import ContactDrawer from './ContactDrawer';
import { PulseDot } from './Icons';

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; contact: Contact };

interface Props {
  contacts: Contact[];
  meetings: Meeting[];
  newContactOpen: boolean;
  onNewContactClose: () => void;
  onSave: (input: NewContact, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onLinkMeeting: (meetingId: string, contactId: string | null) => Promise<void>;
  onAddActivity: (
    contactId: string,
    input: { type: ActivityType; title: string; body?: string; timestamp?: number }
  ) => Promise<void>;
  onDeleteActivity: (contactId: string, activityId: string) => Promise<void>;
}

export default function ContactsView({
  contacts,
  meetings,
  newContactOpen,
  onNewContactClose,
  onSave,
  onDelete,
  onLinkMeeting,
  onAddActivity,
  onDeleteActivity
}: Props) {
  const [search, setSearch] = useState('');
  const [stufeFilter, setStufeFilter] = useState<Stufe | null>(null);
  const [originFilter, setOriginFilter] = useState<Origin | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });

  useEffect(() => {
    if (newContactOpen) setDrawer({ mode: 'new' });
  }, [newContactOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (stufeFilter && c.stufe !== stufeFilter) return false;
      if (originFilter && c.origin !== originFilter) return false;
      if (!q) return true;
      const hay = [
        c.name, c.unternehmen, c.telefon, c.email, c.web,
        c.verkehrsarten, c.notizen, c.termin, c.fahrer, c.fahrzeuge
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, search, stufeFilter, originFilter]);

  const counts = useMemo(() => {
    const by: Record<Stufe, number> = { K: 0, V: 0, T: 0 };
    for (const c of contacts) by[c.stufe]++;
    return { total: contacts.length, ...by };
  }, [contacts]);

  const meetingStatsByContact = useMemo(() => {
    const map = new Map<
      string,
      { total: number; running: number; upcoming: number }
    >();
    for (const mt of meetings) {
      if (!mt.contactId) continue;
      const s = meetingState(mt.startTime, mt.duration);
      const cur = map.get(mt.contactId) || { total: 0, running: 0, upcoming: 0 };
      cur.total += 1;
      if (s === 'running') cur.running += 1;
      else if (s === 'upcoming') cur.upcoming += 1;
      map.set(mt.contactId, cur);
    }
    return map;
  }, [meetings]);

  function closeDrawer() {
    setDrawer({ mode: 'closed' });
    onNewContactClose();
  }

  async function handleSave(input: NewContact, id?: string) {
    await onSave(input, id);
    closeDrawer();
  }

  async function handleDelete(id: string) {
    await onDelete(id);
    closeDrawer();
  }

  const hasFilters = Boolean(search) || stufeFilter !== null || originFilter !== null;
  const liveDrawerContact =
    drawer.mode === 'edit'
      ? contacts.find((c) => c.id === drawer.contact.id) || drawer.contact
      : null;
  const meetingsForDrawer = liveDrawerContact
    ? meetings.filter((m) => m.contactId === liveDrawerContact.id)
    : [];
  const activitiesForDrawer = liveDrawerContact?.activities || [];

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Gesamt" value={counts.total} />
        <StatCard label="Kalt" value={counts.K} accent="slate" />
        <StatCard label="Vorschau" value={counts.V} accent="amber" />
        <StatCard label="Testtermin" value={counts.T} accent="emerald" />
      </section>

      <section className="bg-white rounded-xl ring-1 ring-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-slate-50"
          />
        </div>

        <ChipGroup
          label="Stufe"
          value={stufeFilter}
          onChange={setStufeFilter}
          options={(['K', 'V', 'T'] as Stufe[]).map((s) => ({
            value: s,
            label: STUFE_META[s].label
          }))}
        />
        <ChipGroup
          label="Origin"
          value={originFilter}
          onChange={setOriginFilter}
          options={(['F', 'T'] as Origin[]).map((o) => ({
            value: o,
            label: ORIGIN_META[o].label
          }))}
        />

        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setStufeFilter(null);
              setOriginFilter(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-900 ml-auto"
          >
            Zurücksetzen
          </button>
        )}
      </section>

      <ContactTable
        contacts={filtered}
        totalCount={contacts.length}
        meetingStatsByContact={meetingStatsByContact}
        onRowClick={(c) => setDrawer({ mode: 'edit', contact: c })}
      />

      <footer className="text-center text-xs text-slate-400 pt-4">
        {contacts.length} Kontakte · {meetings.length} Zoom-Meetings synchronisiert
      </footer>

      {drawer.mode !== 'closed' && (
        <ContactDrawer
          initial={liveDrawerContact}
          meetings={meetingsForDrawer}
          activities={activitiesForDrawer}
          onClose={closeDrawer}
          onSave={handleSave}
          onDelete={handleDelete}
          onUnlinkMeeting={(mid) => onLinkMeeting(mid, null)}
          onAddActivity={
            liveDrawerContact
              ? (input) => onAddActivity(liveDrawerContact.id, input)
              : undefined
          }
          onDeleteActivity={
            liveDrawerContact
              ? (aid) => onDeleteActivity(liveDrawerContact.id, aid)
              : undefined
          }
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent
}: {
  label: string;
  value: number;
  accent?: 'slate' | 'amber' | 'emerald';
}) {
  const dot =
    accent === 'slate'
      ? 'bg-slate-400'
      : accent === 'amber'
      ? 'bg-amber-500'
      : accent === 'emerald'
      ? 'bg-emerald-500'
      : 'bg-indigo-500';
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-xs text-slate-500 mr-1">{label}</span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(active ? null : opt.value)}
            className={
              'px-3 py-1 rounded-full text-xs font-medium ring-1 transition-colors ' +
              (active
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ContactTable({
  contacts,
  totalCount,
  meetingStatsByContact,
  onRowClick
}: {
  contacts: Contact[];
  totalCount: number;
  meetingStatsByContact: Map<string, { total: number; running: number; upcoming: number }>;
  onRowClick: (c: Contact) => void;
}) {
  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-200 py-16 text-center">
        <p className="text-slate-500">
          {totalCount === 0
            ? 'Noch keine Kontakte.'
            : 'Keine Kontakte entsprechen den Filtern.'}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-6 py-3">Kontakt</th>
              <th className="text-left font-medium px-6 py-3">Flotte</th>
              <th className="text-left font-medium px-6 py-3">V.Arten</th>
              <th className="text-left font-medium px-6 py-3">Termin</th>
              <th className="text-left font-medium px-6 py-3">Meetings</th>
              <th className="text-left font-medium px-6 py-3">Stufe</th>
              <th className="text-left font-medium px-6 py-3">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => {
              const stats = meetingStatsByContact.get(c.id) || { total: 0, running: 0, upcoming: 0 };
              return (
                <tr
                  key={c.id}
                  onClick={() => onRowClick(c)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 min-w-[220px]">
                    <div className="font-medium text-slate-900">
                      {c.name || <span className="text-slate-400">—</span>}
                    </div>
                    {c.unternehmen && (
                      <div className="text-slate-500 text-xs mt-0.5">{c.unternehmen}</div>
                    )}
                    <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-2">
                      {c.telefon && <span className="whitespace-nowrap">{c.telefon}</span>}
                      {c.telefon && c.email && <span>·</span>}
                      {c.email && <span className="truncate">{c.email}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {c.fahrer || c.fahrzeuge ? (
                      <div className="text-xs space-y-0.5 text-slate-600">
                        {c.fahrer && (
                          <div>
                            <span className="text-slate-400">Fahrer:</span> {c.fahrer}
                          </div>
                        )}
                        {c.fahrzeuge && (
                          <div>
                            <span className="text-slate-400">Kfz:</span> {c.fahrzeuge}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-[200px]">
                    <div className="line-clamp-2">
                      {c.verkehrsarten || <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                    {c.termin || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {stats.total > 0 ? (
                      <div className="flex items-center gap-1.5">
                        {stats.running > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300 rounded-full px-2 py-0.5"
                            title="Meeting läuft gerade"
                          >
                            <PulseDot className="w-1.5 h-1.5" />
                            Live
                          </span>
                        )}
                        <span
                          className={
                            'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ring-1 ' +
                            (stats.upcoming > 0
                              ? 'text-indigo-700 bg-indigo-50 ring-indigo-200'
                              : 'text-slate-600 bg-slate-50 ring-slate-200')
                          }
                          title={`${stats.total} Meetings · ${stats.upcoming} bevorstehend`}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                          {stats.total}
                          {stats.upcoming > 0 && (
                            <span className="text-indigo-500">· {stats.upcoming}↑</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StufeBadge stufe={c.stufe} />
                  </td>
                  <td className="px-6 py-4">
                    <OriginBadge origin={c.origin} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StufeBadge({ stufe }: { stufe: Stufe }) {
  const meta = STUFE_META[stufe];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${meta.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function OriginBadge({ origin }: { origin: Origin }) {
  const meta = ORIGIN_META[origin];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${meta.chip}`}
    >
      {meta.label}
    </span>
  );
}

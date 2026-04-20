import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import type { Contact, Meeting, NewContact, NewMeeting } from '../types';
import { meetingState, vorschauHighlight } from '../types';
import type { Route } from '../routing';
import MeetingDrawer from './MeetingDrawer';
import ContactDrawer from './ContactDrawer';
import MeetingCreateDrawer from './MeetingCreateDrawer';
import { PlusIcon, PulseDot } from './Icons';
import './calendar-theme.css';

interface Props {
  route: Route;
  setRoute: (next: Route | ((prev: Route) => Route)) => void;
  meetings: Meeting[];
  contacts: Contact[];
  onLinkMeeting: (meetingId: string, contactId: string | null) => Promise<void>;
  onCreateContact: (input: NewContact) => Promise<Contact>;
  onSetSellers: (meetingId: string, sellers: import('../types').Origin[]) => Promise<void>;
  onCreateMeeting: (input: NewMeeting) => Promise<Meeting>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onRescheduleMeeting: (
    meetingId: string,
    input: { startTime: string; duration: number; timezone?: string }
  ) => Promise<void>;
}

function extractContactHintFromTopic(topic: string): Partial<NewContact> {
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
  hint.notizen = `Ursprung: Zoom-Meeting „${topic}"`;
  return hint;
}

export default function CalendarView({
  route,
  setRoute,
  meetings,
  contacts,
  onLinkMeeting,
  onCreateContact,
  onSetSellers,
  onCreateMeeting,
  onDeleteMeeting,
  onRescheduleMeeting
}: Props) {
  const [creatingForMeeting, setCreatingForMeeting] = useState<Meeting | null>(null);
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [createDraftDate, setCreateDraftDate] = useState<{
    start: Date | null;
    end: Date | null;
  } | null>(null);
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  const selected = route.meetingId
    ? meetings.find((m) => m.id === route.meetingId) || null
    : null;
  const showCreate = !!route.newMeeting;
  const createDraft = showCreate ? createDraftDate || { start: null, end: null } : null;

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  const visibleMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (!m.startTime) return false;
      if (filterLinked === 'linked' && !m.contactId) return false;
      if (filterLinked === 'unlinked' && m.contactId) return false;
      return true;
    });
  }, [meetings, filterLinked]);

  const events = useMemo(() => {
    return visibleMeetings.map((m) => {
      const contact = m.contactId ? contactById.get(m.contactId) : null;
      const start = m.startTime!;
      const endDate = new Date(Date.parse(start) + (m.duration || 30) * 60000);
      const state = meetingState(m.startTime, m.duration);
      const vh = vorschauHighlight(contact);
      return {
        id: m.id,
        title: m.topic || 'Ohne Titel',
        start,
        end: endDate.toISOString(),
        extendedProps: { meeting: m, contact, state },
        classNames: [
          'crm-ev',
          contact ? 'crm-ev-linked' : 'crm-ev-unlinked',
          m.matchMode === 'auto' ? 'crm-ev-auto' : '',
          state === 'running' ? 'crm-ev-live' : '',
          state === 'past' ? 'crm-ev-past' : '',
          vh === 'needs-files' ? 'crm-ev-vorschau-needs-files' : '',
          vh === 'has-files' ? 'crm-ev-vorschau-has-files' : ''
        ]
      };
    });
  }, [visibleMeetings, contactById]);

  const runningCount = meetings.filter(
    (m) => meetingState(m.startTime, m.duration) === 'running'
  ).length;
  const upcomingCount = meetings.filter(
    (m) => meetingState(m.startTime, m.duration) === 'upcoming'
  ).length;
  const pastCount = meetings.filter(
    (m) => meetingState(m.startTime, m.duration) === 'past'
  ).length;
  const unlinkedCount = meetings.filter((m) => !m.contactId && m.startTime).length;
  const linkedCount = meetings.filter((m) => m.contactId && m.startTime).length;

  function openMeeting(id: string | null) {
    if (id) setRoute({ tab: 'calendar', meetingId: id });
    else setRoute({ tab: 'calendar' });
  }

  function openCreate(start: Date | null, end: Date | null) {
    setCreateDraftDate(start ? { start, end } : null);
    setRoute({ tab: 'calendar', newMeeting: true });
  }

  function closeCreate() {
    setCreateDraftDate(null);
    setRoute({ tab: 'calendar' });
  }

  function onEventClick(arg: EventClickArg) {
    const m = arg.event.extendedProps.meeting as Meeting;
    openMeeting(m.id);
  }

  function onDateClick(arg: DateClickArg) {
    const start = new Date(arg.date);
    if (arg.allDay) start.setHours(10, 0, 0, 0);
    openCreate(start, null);
  }

  function onSelect(arg: DateSelectArg) {
    openCreate(arg.start, arg.end);
  }

  function renderEventContent(arg: EventContentArg) {
    const contact = arg.event.extendedProps.contact as Contact | null;
    const m = arg.event.extendedProps.meeting as Meeting;
    const time = arg.event.start
      ? arg.event.start.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    return (
      <div className="overflow-hidden px-1.5 py-0.5 text-xs leading-tight">
        <div className="flex items-center gap-1 font-medium truncate">
          <span className="opacity-60 tabular-nums">{time}</span>
          <span className="truncate">
            {contact ? contact.name || contact.unternehmen : m.topic}
          </span>
        </div>
        {contact && (
          <div className="text-[10px] opacity-70 truncate">{m.topic}</div>
        )}
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Insgesamt" value={meetings.length} />
        <StatCard label="Läuft gerade" value={runningCount} tone="live" />
        <StatCard label="Bevorstehend" value={upcomingCount} tone="indigo" />
        <StatCard label="Abgelaufen" value={pastCount} tone="slate" />
      </section>

      <section className="bg-white rounded-xl ring-1 ring-slate-200 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Verknüpfung</span>
        <ChipToggle
          value={filterLinked}
          options={[
            { value: 'all', label: `Alle (${meetings.length})` },
            { value: 'linked', label: `Verknüpft (${linkedCount})` },
            { value: 'unlinked', label: `Offen (${unlinkedCount})` }
          ]}
          onChange={setFilterLinked}
        />
        <span className="hidden sm:inline text-xs text-slate-400 ml-auto">
          Tag klicken · Zeitraum ziehen · oder
        </span>
        <span className="sm:hidden ml-auto" />

        <button
          type="button"
          onClick={() => openCreate(null, null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Neues Meeting
        </button>
      </section>

      {isMobile ? (
        <MobileMeetingList
          meetings={visibleMeetings}
          contactById={contactById}
          onSelect={(m) => openMeeting(m.id)}
        />
      ) : (
        <section className="bg-white rounded-xl ring-1 ring-slate-200 p-2 sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="de"
            firstDay={1}
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listMonth'
            }}
            buttonText={{
              today: 'Heute',
              month: 'Monat',
              week: 'Woche',
              day: 'Tag',
              list: 'Liste'
            }}
            events={events}
            eventClick={onEventClick}
            eventContent={renderEventContent}
            eventDisplay="block"
            displayEventTime={false}
            dayMaxEvents={4}
            nowIndicator
            weekNumbers={false}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            dateClick={onDateClick}
            selectable
            select={onSelect}
          />
        </section>
      )}

      {selected && (
        <MeetingDrawer
          meeting={selected}
          contacts={contacts}
          onClose={() => openMeeting(null)}
          onLink={async (cid) => {
            await onLinkMeeting(selected.id, cid);
          }}
          onCreateContact={() => setCreatingForMeeting(selected)}
          onDelete={async () => {
            await onDeleteMeeting(selected.id);
            openMeeting(null);
          }}
          onSetSellers={async (sellers) => {
            await onSetSellers(selected.id, sellers);
          }}
          onReschedule={async (input) => {
            await onRescheduleMeeting(selected.id, input);
          }}
        />
      )}

      {creatingForMeeting && (
        <ContactDrawer
          initial={null}
          initialDraft={extractContactHintFromTopic(creatingForMeeting.topic)}
          titleOverride="Neuer Kontakt"
          onClose={() => setCreatingForMeeting(null)}
          onSave={async (input) => {
            const created = await onCreateContact(input);
            await onLinkMeeting(creatingForMeeting.id, created.id);
            setCreatingForMeeting(null);
          }}
          onDelete={async () => {}}
        />
      )}

      {createDraft && (
        <MeetingCreateDrawer
          contacts={contacts}
          meetings={meetings}
          initialStart={createDraft.start}
          initialEnd={createDraft.end}
          onClose={closeCreate}
          onCreate={async (input) => {
            await onCreateMeeting(input);
          }}
          onCreateContact={onCreateContact}
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: 'live' | 'indigo' | 'slate';
}) {
  const dotCls =
    tone === 'indigo'
      ? 'bg-indigo-500'
      : tone === 'slate'
      ? 'bg-slate-300'
      : 'bg-slate-400';
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
        {tone === 'live' ? (
          <PulseDot className="w-1.5 h-1.5" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        )}
        {label}
      </div>
      <div
        className={
          'mt-2 text-3xl font-semibold tabular-nums ' +
          (tone === 'live' && value > 0 ? 'text-emerald-600' : 'text-slate-900')
        }
      >
        {value}
      </div>
    </div>
  );
}

function ChipToggle<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={
              'px-3 py-1 rounded-md text-xs font-medium transition-colors ' +
              (active
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MobileMeetingList({
  meetings,
  contactById,
  onSelect
}: {
  meetings: Meeting[];
  contactById: Map<string, Contact>;
  onSelect: (m: Meeting) => void;
}) {
  const groups = useMemo(() => {
    const byDay = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!m.startTime) continue;
      const key = m.startTime.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(m);
    }
    const sorted = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, list] of sorted) {
      list.sort((a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!));
    }
    return sorted;
  }, [meetings]);

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-200 py-12 text-center">
        <p className="text-slate-500 text-sm">Keine Meetings</p>
      </div>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayIdx = groups.findIndex(([k]) => k >= todayKey);

  return (
    <div className="space-y-5">
      {groups.map(([dayKey, dayMeetings], gi) => {
        const isFirstFuture = gi === todayIdx;
        return (
          <section key={dayKey}>
            <h3
              className={
                'text-xs font-semibold uppercase tracking-wider mb-2 px-1 ' +
                (dayKey === todayKey
                  ? 'text-indigo-700'
                  : dayKey < todayKey
                  ? 'text-slate-400'
                  : 'text-slate-600')
              }
            >
              {formatDayHeader(dayKey)}
              {isFirstFuture && dayKey !== todayKey && (
                <span className="ml-2 text-[10px] text-slate-400 font-normal normal-case">
                  — ab hier kommt's
                </span>
              )}
            </h3>
            <ul className="space-y-2">
              {dayMeetings.map((m) => (
                <MobileMeetingCard
                  key={m.id}
                  meeting={m}
                  contact={m.contactId ? contactById.get(m.contactId) || null : null}
                  onClick={() => onSelect(m)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MobileMeetingCard({
  meeting,
  contact,
  onClick
}: {
  meeting: Meeting;
  contact: Contact | null;
  onClick: () => void;
}) {
  const state = meetingState(meeting.startTime, meeting.duration);
  const vh = vorschauHighlight(contact);

  const start = meeting.startTime ? new Date(meeting.startTime) : null;
  const end = start
    ? new Date(start.getTime() + (meeting.duration || 30) * 60000)
    : null;
  const timeStr =
    start && end
      ? `${start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      : '';

  let borderCls = 'border-slate-200';
  let ringCls = 'ring-slate-200';
  if (state === 'running') {
    borderCls = 'border-emerald-500';
    ringCls = 'ring-emerald-300';
  } else if (vh === 'needs-files') {
    borderCls = 'border-rose-500';
    ringCls = 'ring-rose-300';
  } else if (vh === 'has-files') {
    borderCls = 'border-emerald-500';
    ringCls = 'ring-emerald-300';
  } else if (contact) {
    borderCls = 'border-indigo-500';
    ringCls = 'ring-indigo-200';
  }

  const faded = state === 'past';

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          'w-full text-left bg-white rounded-xl ring-1 border-l-4 px-3 py-3 active:bg-slate-50 transition-colors ' +
          `${borderCls} ${ringCls} ` +
          (faded ? 'opacity-70' : '')
        }
      >
        <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
          <span className="font-semibold tabular-nums text-slate-900">{timeStr}</span>
          <span className="text-slate-400">· {meeting.duration} Min</span>
          {state === 'running' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300 rounded-full px-1.5 py-0.5">
              <PulseDot className="w-1.5 h-1.5" />
              Live
            </span>
          )}
          {state === 'past' && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Vorbei
            </span>
          )}
          {meeting.matchMode === 'auto' && (
            <span className="text-[10px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5 py-0.5">
              auto
            </span>
          )}
        </div>
        {contact ? (
          <>
            <div className="font-medium text-slate-900 text-sm truncate">
              {contact.name || contact.unternehmen || '—'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{meeting.topic}</div>
          </>
        ) : (
          <>
            <div className="font-medium text-slate-900 text-sm break-words">
              {meeting.topic || 'Ohne Titel'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Kein Kontakt zugeordnet</div>
          </>
        )}
        {(state === 'running' || state === 'upcoming') && meeting.joinUrl && (
          <a
            href={meeting.joinUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={
              'mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-md ' +
              (state === 'running'
                ? 'bg-emerald-600 text-white'
                : 'text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200')
            }
          >
            {state === 'running' ? 'Jetzt beitreten' : 'Join-Link'}
          </a>
        )}
      </button>
    </li>
  );
}

function formatDayHeader(dayKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dayKey === todayKey) return 'Heute';
  if (dayKey === tomorrowKey) return 'Morgen';
  if (dayKey === yesterdayKey) return 'Gestern';

  const d = new Date(dayKey + 'T00:00:00');
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: sameYear ? undefined : '2-digit'
  });
}

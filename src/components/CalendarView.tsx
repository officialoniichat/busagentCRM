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
import MeetingDrawer from './MeetingDrawer';
import ContactDrawer from './ContactDrawer';
import MeetingCreateDrawer from './MeetingCreateDrawer';
import { PlusIcon, PulseDot } from './Icons';
import './calendar-theme.css';

interface Props {
  meetings: Meeting[];
  contacts: Contact[];
  onLinkMeeting: (meetingId: string, contactId: string | null) => Promise<void>;
  onCreateContact: (input: NewContact) => Promise<Contact>;
  onSetSellers: (meetingId: string, sellers: import('../types').Origin[]) => Promise<void>;
  onCreateMeeting: (input: NewMeeting) => Promise<Meeting>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
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
  meetings,
  contacts,
  onLinkMeeting,
  onCreateContact,
  onSetSellers,
  onCreateMeeting,
  onDeleteMeeting
}: Props) {
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [creatingForMeeting, setCreatingForMeeting] = useState<Meeting | null>(null);
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [createDraft, setCreateDraft] = useState<{
    start: Date | null;
    end: Date | null;
  } | null>(null);
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

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

  function onEventClick(arg: EventClickArg) {
    const m = arg.event.extendedProps.meeting as Meeting;
    setSelected(m);
  }

  function onDateClick(arg: DateClickArg) {
    const start = new Date(arg.date);
    if (arg.allDay) start.setHours(10, 0, 0, 0);
    setCreateDraft({ start, end: null });
  }

  function onSelect(arg: DateSelectArg) {
    setCreateDraft({ start: arg.start, end: arg.end });
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
        <span className="text-xs text-slate-400 ml-auto">
          Tag klicken · Zeitraum ziehen · oder
        </span>
        <button
          type="button"
          onClick={() => setCreateDraft({ start: null, end: null })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Neues Meeting
        </button>
      </section>

      <section className="bg-white rounded-xl ring-1 ring-slate-200 p-2 sm:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
          locale="de"
          firstDay={1}
          height="auto"
          headerToolbar={
            isMobile
              ? { left: 'prev,next', center: 'title', right: 'listMonth,dayGridMonth' }
              : {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,listMonth'
                }
          }
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

      {selected && (
        <MeetingDrawer
          meeting={selected}
          contacts={contacts}
          onClose={() => setSelected(null)}
          onLink={async (cid) => {
            await onLinkMeeting(selected.id, cid);
            const updated = meetings.find((m) => m.id === selected.id);
            setSelected(updated ? { ...updated, contactId: cid ?? undefined } : null);
          }}
          onCreateContact={() => setCreatingForMeeting(selected)}
          onDelete={async () => {
            await onDeleteMeeting(selected.id);
            setSelected(null);
          }}
          onSetSellers={async (sellers) => {
            await onSetSellers(selected.id, sellers);
            setSelected({ ...selected, assignedSellers: sellers });
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
            setSelected({ ...creatingForMeeting, contactId: created.id, matchMode: 'manual' });
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
          onClose={() => setCreateDraft(null)}
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

import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import type { Contact, Meeting, NewTask, Origin, Task } from '../types';
import { MEETING_ORIGINS, ORIGIN_META, meetingState, vorschauHighlight } from '../types';
import type { Route } from '../routing';
import MeetingDrawer from './MeetingDrawer';
import TaskDrawer from './TaskDrawer';
import { PlusIcon, PulseDot } from './Icons';
import './calendar-theme.css';

const WHO_KEY = 'crm.whoAmI';

interface Props {
  route: Route;
  setRoute: (next: Route | ((prev: Route) => Route)) => void;
  meetings: Meeting[];
  contacts: Contact[];
  tasks: Task[];
  onLinkMeeting: (meetingId: string, contactId: string | null) => Promise<void>;
  onSetSellers: (meetingId: string, sellers: Origin[]) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onRescheduleMeeting: (
    meetingId: string,
    input: { startTime: string; duration: number; timezone?: string }
  ) => Promise<void>;
  onCreateTask: (input: NewTask) => Promise<Task>;
  onUpdateTask: (id: string, patch: Partial<NewTask>) => Promise<Task>;
  onDeleteTask: (id: string) => Promise<void>;
}

export default function TasksView({
  route,
  setRoute,
  meetings,
  contacts,
  tasks,
  onLinkMeeting,
  onSetSellers,
  onDeleteMeeting,
  onRescheduleMeeting,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}: Props) {
  const [whoAmI, setWhoAmI] = useState<Origin | null>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(WHO_KEY) : null;
    return saved === 'F' || saved === 'T' ? saved : null;
  });
  const [taskDraftDate, setTaskDraftDate] = useState<string | undefined>();
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  const selectedMeeting = route.meetingId
    ? meetings.find((m) => m.id === route.meetingId) || null
    : null;
  const showNewTask = !!route.newTask;
  const editTask = route.taskId ? tasks.find((t) => t.id === route.taskId) || null : null;
  const taskDrawerOpen = showNewTask || !!editTask;

  function openMeeting(id: string | null) {
    if (id) setRoute({ tab: 'tasks', meetingId: id });
    else setRoute({ tab: 'tasks' });
  }

  function openNewTask(defaultDate?: string) {
    setTaskDraftDate(defaultDate);
    setRoute({ tab: 'tasks', newTask: true });
  }

  function openEditTask(id: string) {
    setRoute({ tab: 'tasks', taskId: id });
  }

  function closeTaskDrawer() {
    setTaskDraftDate(undefined);
    setRoute({ tab: 'tasks' });
  }

  function pickWho(o: Origin) {
    window.localStorage.setItem(WHO_KEY, o);
    setWhoAmI(o);
  }

  function resetWho() {
    window.localStorage.removeItem(WHO_KEY);
    setWhoAmI(null);
  }

  const myMeetings = useMemo(() => {
    if (!whoAmI) return [];
    return meetings.filter(
      (m) => (m.assignedSellers || []).includes(whoAmI) && m.startTime
    );
  }, [meetings, whoAmI]);

  const myTasks = useMemo(() => {
    if (!whoAmI) return [];
    return tasks.filter((t) => t.owner === whoAmI);
  }, [tasks, whoAmI]);

  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  const events = useMemo(() => {
    const meetingEvents = myMeetings.map((m) => {
      const contact = m.contactId ? contactById.get(m.contactId) : null;
      const start = m.startTime!;
      const endDate = new Date(Date.parse(start) + (m.duration || 30) * 60000);
      const state = meetingState(m.startTime, m.duration);
      const vh = vorschauHighlight(contact);
      return {
        id: `m-${m.id}`,
        title: contact ? (contact.name || contact.unternehmen || m.topic) : m.topic,
        start,
        end: endDate.toISOString(),
        extendedProps: { kind: 'meeting' as const, meeting: m, contact, state },
        classNames: [
          'crm-ev',
          'crm-ev-linked',
          state === 'running' ? 'crm-ev-live' : '',
          state === 'past' ? 'crm-ev-past' : '',
          vh === 'needs-files' ? 'crm-ev-vorschau-needs-files' : '',
          vh === 'has-files' ? 'crm-ev-vorschau-has-files' : ''
        ]
      };
    });
    const taskEvents = myTasks.map((t) => ({
      id: `t-${t.id}`,
      title: t.title,
      start: t.startAt,
      end: t.endAt,
      extendedProps: { kind: 'task' as const, task: t },
      classNames: ['crm-ev', 'crm-ev-task']
    }));
    return [...meetingEvents, ...taskEvents];
  }, [myMeetings, myTasks, contactById]);

  if (!whoAmI) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Wer bist du?</h2>
          <p className="text-sm text-slate-500 mb-8">
            Wähle dich aus, um deine Meetings und Tasks zu sehen. Du kannst später oben
            jederzeit wechseln.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            {MEETING_ORIGINS.map((o) => (
              <button
                key={o}
                onClick={() => pickWho(o)}
                className={
                  'px-5 py-6 rounded-xl ring-1 text-left transition-all hover:scale-[1.02] ' +
                  ORIGIN_META[o].chip
                }
              >
                <div className="text-xs font-medium uppercase tracking-wider opacity-60">
                  {ORIGIN_META[o].role}
                </div>
                <div className="text-2xl font-semibold mt-1">{ORIGIN_META[o].label}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const meetingCount = myMeetings.length;
  const runningNow = myMeetings.filter(
    (m) => meetingState(m.startTime, m.duration) === 'running'
  ).length;
  const upcomingCount = myMeetings.filter(
    (m) => meetingState(m.startTime, m.duration) === 'upcoming'
  ).length;

  function handleEventClick(arg: EventClickArg) {
    const { kind } = arg.event.extendedProps as { kind: 'meeting' | 'task' };
    if (kind === 'meeting') {
      const m = (arg.event.extendedProps as { meeting: Meeting }).meeting;
      openMeeting(m.id);
    } else {
      const t = (arg.event.extendedProps as { task: Task }).task;
      openEditTask(t.id);
    }
  }

  function handleDateSelect(arg: DateSelectArg) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = arg.start;
    const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    openNewTask(dateKey);
  }

  function renderEventContent(arg: EventContentArg) {
    const kind = arg.event.extendedProps.kind as 'meeting' | 'task';
    const time = arg.event.start
      ? arg.event.start.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    if (kind === 'task') {
      return (
        <div className="overflow-hidden px-1.5 py-0.5 text-xs leading-tight">
          <div className="font-medium truncate">
            <span className="opacity-60 tabular-nums mr-1">{time}</span>
            {arg.event.title}
          </div>
        </div>
      );
    }
    const contact = arg.event.extendedProps.contact as Contact | null;
    const m = arg.event.extendedProps.meeting as Meeting;
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
      <section className="bg-white rounded-xl ring-1 ring-slate-200 p-4 sm:p-5 flex items-center gap-3 sm:gap-4 flex-wrap">
        <div
          className={
            'w-12 h-12 rounded-xl ring-1 grid place-items-center font-semibold ' +
            ORIGIN_META[whoAmI].chip
          }
        >
          {ORIGIN_META[whoAmI].label.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {ORIGIN_META[whoAmI].role}
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {ORIGIN_META[whoAmI].label}
          </div>
        </div>
        <button
          onClick={resetWho}
          className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          Wechseln
        </button>
        <button
          onClick={() => openNewTask()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Task
        </button>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Meine Meetings" value={meetingCount} />
        <StatCard label="Läuft gerade" value={runningNow} tone="live" />
        <StatCard label="Bevorstehend" value={upcomingCount} tone="indigo" />
        <StatCard label="Eigene Tasks" value={myTasks.length} tone="amber" />
      </section>

      <section className="bg-white rounded-xl ring-1 ring-slate-200 p-2 sm:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          locale="de"
          firstDay={1}
          height="auto"
          headerToolbar={
            isMobile
              ? { left: 'prev,next', center: 'title', right: 'timeGridDay,listWeek' }
              : {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek'
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
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          eventDisplay="block"
          displayEventTime={false}
          dayMaxEvents={4}
          selectable
          select={handleDateSelect}
          nowIndicator
          weekNumbers={false}
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
        />
      </section>

      {selectedMeeting && (
        <MeetingDrawer
          meeting={selectedMeeting}
          contacts={contacts}
          allMeetings={meetings}
          onClose={() => openMeeting(null)}
          onLink={async (cid) => {
            await onLinkMeeting(selectedMeeting.id, cid);
          }}
          onCreateContact={() => {}}
          onDelete={async () => {
            await onDeleteMeeting(selectedMeeting.id);
            openMeeting(null);
          }}
          onSetSellers={async (sellers) => {
            await onSetSellers(selectedMeeting.id, sellers);
          }}
          onReschedule={async (input) => {
            await onRescheduleMeeting(selectedMeeting.id, input);
          }}
        />
      )}

      {taskDrawerOpen && (
        <TaskDrawer
          owner={whoAmI}
          initial={editTask}
          defaultDate={editTask ? undefined : taskDraftDate}
          onClose={closeTaskDrawer}
          onSave={async (input, id) => {
            if (id) await onUpdateTask(id, input);
            else await onCreateTask(input);
            closeTaskDrawer();
          }}
          onDelete={
            editTask
              ? async (id) => {
                  await onDeleteTask(id);
                  closeTaskDrawer();
                }
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
  tone
}: {
  label: string;
  value: number;
  tone?: 'live' | 'indigo' | 'amber';
}) {
  const dotCls =
    tone === 'indigo'
      ? 'bg-indigo-500'
      : tone === 'amber'
      ? 'bg-amber-500'
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

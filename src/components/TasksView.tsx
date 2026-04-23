import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventContentArg, EventMountArg } from '@fullcalendar/core';
import type { Contact, Meeting, NewTask, NewTaskCategory, Origin, Task, TaskCategory } from '../types';
import { MEETING_ORIGINS, ORIGIN_META, TASK_CATEGORY_COLORS, meetingState, vorschauHighlight } from '../types';
import type { Route } from '../routing';
import MeetingDrawer from './MeetingDrawer';
import TaskDrawer from './TaskDrawer';
import { PlusIcon, PulseDot, XIcon } from './Icons';
import './calendar-theme.css';

const WHO_KEY = 'crm.whoAmI';

interface Props {
  route: Route;
  setRoute: (next: Route | ((prev: Route) => Route)) => void;
  meetings: Meeting[];
  contacts: Contact[];
  tasks: Task[];
  taskCategories: TaskCategory[];
  onLinkMeeting: (meetingId: string, contactId: string | null) => Promise<void>;
  onSetSellers: (meetingId: string, sellers: Origin[]) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onRescheduleMeeting: (
    meetingId: string,
    input: { startTime: string; duration: number; timezone?: string; by: Origin }
  ) => Promise<void>;
  user: import('../auth').SessionUser;
  onCreateTask: (input: NewTask) => Promise<Task>;
  onUpdateTask: (id: string, patch: Partial<NewTask>) => Promise<Task>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateTaskCategory: (input: NewTaskCategory) => Promise<TaskCategory>;
  onUpdateTaskCategory: (
    id: string,
    patch: Partial<NewTaskCategory>
  ) => Promise<TaskCategory>;
  onDeleteTaskCategory: (id: string) => Promise<void>;
}

export default function TasksView({
  route,
  setRoute,
  meetings,
  contacts,
  tasks,
  taskCategories,
  onLinkMeeting,
  onSetSellers,
  onDeleteMeeting,
  onRescheduleMeeting,
  user,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCreateTaskCategory,
  onUpdateTaskCategory,
  onDeleteTaskCategory
}: Props) {
  const [whoAmI, setWhoAmI] = useState<Origin | null>(() => {
    if (user.origin) return user.origin;
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(WHO_KEY) : null;
    return saved === 'F' || saved === 'T' || saved === 'D' ? saved : null;
  });
  const [taskDraft, setTaskDraft] = useState<{
    startAt?: string;
    endAt?: string;
  }>({});
  const [managingCategories, setManagingCategories] = useState(false);
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

  function openNewTask(draft: { startAt?: string; endAt?: string } = {}) {
    setTaskDraft(draft);
    setRoute({ tab: 'tasks', newTask: true });
  }

  function openEditTask(id: string) {
    setRoute({ tab: 'tasks', taskId: id });
  }

  function closeTaskDrawer() {
    setTaskDraft({});
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

  const categoryById = useMemo(() => {
    const m = new Map<string, TaskCategory>();
    for (const c of taskCategories) m.set(c.id, c);
    return m;
  }, [taskCategories]);

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
    const taskEvents = myTasks.map((t) => {
      const cat = t.categoryId ? categoryById.get(t.categoryId) : null;
      const contact = t.contactId ? contactById.get(t.contactId) : null;
      return {
        id: `t-${t.id}`,
        title: t.title,
        start: t.startAt,
        end: t.endAt,
        extendedProps: { kind: 'task' as const, task: t, category: cat, contact },
        classNames: ['crm-ev', 'crm-ev-task', cat ? 'crm-ev-task-cat' : '']
      };
    });
    return [...meetingEvents, ...taskEvents];
  }, [myMeetings, myTasks, contactById, categoryById]);

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
    if (arg.allDay) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const d = arg.start;
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const startAt = new Date(`${dateKey}T09:00:00`).toISOString();
      const endAt = new Date(`${dateKey}T10:00:00`).toISOString();
      openNewTask({ startAt, endAt });
      return;
    }
    openNewTask({
      startAt: arg.start.toISOString(),
      endAt: arg.end.toISOString()
    });
  }

  function handleEventMount(arg: EventMountArg) {
    const cat = arg.event.extendedProps.category as TaskCategory | undefined;
    if (cat) {
      arg.el.style.setProperty('--crm-cat-color', cat.color);
    } else {
      arg.el.style.removeProperty('--crm-cat-color');
    }
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
      const cat = arg.event.extendedProps.category as TaskCategory | undefined;
      const contact = arg.event.extendedProps.contact as Contact | undefined;
      return (
        <div className="overflow-hidden px-1.5 py-0.5 text-xs leading-tight">
          <div className="font-medium truncate">
            <span className="opacity-60 tabular-nums mr-1">{time}</span>
            {arg.event.title}
          </div>
          {(cat || contact) && (
            <div className="text-[10px] opacity-80 truncate flex items-center gap-1">
              {cat && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-none"
                  style={{ background: cat.color }}
                />
              )}
              {cat?.label}
              {cat && contact && <span className="opacity-40">·</span>}
              {contact && (contact.name || contact.unternehmen)}
            </div>
          )}
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
          onClick={() => setManagingCategories(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-200 bg-white hover:bg-slate-50 transition-colors"
          title="Task-Kategorien verwalten"
        >
          <span className="flex items-center -space-x-1">
            {taskCategories.length === 0 ? (
              <span className="w-2 h-2 rounded-full bg-slate-300 ring-1 ring-white" />
            ) : (
              taskCategories.slice(0, 3).map((c) => (
                <span
                  key={c.id}
                  className="w-2.5 h-2.5 rounded-full ring-1 ring-white"
                  style={{ background: c.color }}
                />
              ))
            )}
          </span>
          Kategorien
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
          eventDidMount={handleEventMount}
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
          defaultBy={user.origin}
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
          draftStartAt={editTask ? undefined : taskDraft.startAt}
          draftEndAt={editTask ? undefined : taskDraft.endAt}
          contacts={contacts}
          categories={taskCategories}
          currentUserOrigin={user.origin}
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
          onToggleDone={async (id, done, by) => {
            await onUpdateTask(id, {
              done,
              ...(done ? { doneAt: Date.now(), doneBy: by } : {})
            });
          }}
        />
      )}

      {managingCategories && (
        <CategoryManagerDrawer
          categories={taskCategories}
          onClose={() => setManagingCategories(false)}
          onCreate={onCreateTaskCategory}
          onUpdate={onUpdateTaskCategory}
          onDelete={onDeleteTaskCategory}
        />
      )}
    </main>
  );
}

function CategoryManagerDrawer({
  categories,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: {
  categories: TaskCategory[];
  onClose: () => void;
  onCreate: (input: NewTaskCategory) => Promise<TaskCategory>;
  onUpdate: (id: string, patch: Partial<NewTaskCategory>) => Promise<TaskCategory>;
  onDelete: (id: string) => Promise<void>;
}) {
  const usedColors = new Set(categories.map((c) => c.color));
  const nextColor =
    TASK_CATEGORY_COLORS.find((c) => !usedColors.has(c)) || TASK_CATEGORY_COLORS[0];

  const [draftLabel, setDraftLabel] = useState('');
  const [draftColor, setDraftColor] = useState(nextColor);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!draftLabel.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await onCreate({ label: draftLabel.trim(), color: draftColor });
      setDraftLabel('');
      setDraftColor(
        TASK_CATEGORY_COLORS.find(
          (c) => ![...usedColors, draftColor].includes(c)
        ) || TASK_CATEGORY_COLORS[0]
      );
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Task-Kategorien</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Farbe bestimmt die Umrandung im Kalender
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Schließen"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <form onSubmit={submitNew} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                Neue Kategorie
              </label>
              <input
                type="text"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="z.B. Akquise"
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              />
            </div>
            <ColorPicker value={draftColor} onChange={setDraftColor} />
            <button
              type="submit"
              disabled={saving || !draftLabel.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              {saving ? 'Lege an…' : 'Kategorie hinzufügen'}
            </button>
            {err && (
              <div className="text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
          </form>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
              Vorhandene Kategorien
            </div>
            {categories.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-2">
                Noch keine Kategorien.
              </div>
            ) : (
              <ul className="space-y-2">
                {categories.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onUpdate,
  onDelete
}: {
  category: TaskCategory;
  onUpdate: (id: string, patch: Partial<NewTaskCategory>) => Promise<TaskCategory>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(category.label);
  const [color, setColor] = useState(category.color);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onUpdate(category.id, { label: label.trim() || category.label, color });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Kategorie „${category.label}" löschen? Tasks behalten sie nicht mehr.`)) return;
    await onDelete(category.id);
  }

  if (editing) {
    return (
      <li className="ring-1 ring-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={() => {
              setLabel(category.label);
              setColor(category.color);
              setEditing(false);
            }}
            className="px-3 py-1.5 text-xs rounded-lg text-slate-700 hover:bg-slate-200"
          >
            Abbrechen
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 ring-1 ring-slate-200 rounded-lg bg-white">
      <span
        className="w-3.5 h-3.5 rounded-full flex-none"
        style={{ background: category.color }}
      />
      <span className="flex-1 text-sm text-slate-900 truncate">{category.label}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50"
      >
        Bearbeiten
      </button>
      <button
        type="button"
        onClick={remove}
        className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
      >
        Löschen
      </button>
    </li>
  );
}

function ColorPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
        Umrandungsfarbe
      </div>
      <div className="flex flex-wrap gap-2">
        {TASK_CATEGORY_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => onChange(c)}
            className={
              'w-7 h-7 rounded-full ring-2 ring-offset-2 ring-offset-white transition-all ' +
              (value === c ? 'ring-slate-900 scale-110' : 'ring-transparent hover:ring-slate-300')
            }
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
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

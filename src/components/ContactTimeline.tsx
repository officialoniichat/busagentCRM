import { useMemo, useState } from 'react';
import type { Activity, ActivityType, Meeting, MeetingState } from '../types';
import { ACTIVITY_TYPE_META, meetingState } from '../types';
import { ActivityIcon, CheckIcon, PlusIcon, XIcon } from './Icons';

interface Props {
  activities: Activity[];
  meetings: Meeting[];
  onAddActivity: (input: {
    type: ActivityType;
    title: string;
    body?: string;
    timestamp?: number;
  }) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
  onUnlinkMeeting?: (meetingId: string) => Promise<void>;
}

type TimelineItem =
  | { kind: 'activity'; activity: Activity; ts: number; state: MeetingState }
  | { kind: 'meeting'; meeting: Meeting; ts: number; state: MeetingState };

function activityState(a: Activity): MeetingState {
  if (a.type === 'termin' && a.timestamp > Date.now()) return 'upcoming';
  return 'past';
}

export default function ContactTimeline({
  activities,
  meetings,
  onAddActivity,
  onDeleteActivity,
  onUnlinkMeeting
}: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const items: TimelineItem[] = useMemo(() => {
    const xs: TimelineItem[] = [];
    for (const a of activities) {
      xs.push({ kind: 'activity', activity: a, ts: a.timestamp, state: activityState(a) });
    }
    for (const m of meetings) {
      if (m.startTime) {
        xs.push({
          kind: 'meeting',
          meeting: m,
          ts: Date.parse(m.startTime),
          state: meetingState(m.startTime, m.duration)
        });
      }
    }
    xs.sort((a, b) => a.ts - b.ts);
    return xs;
  }, [activities, meetings]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
          Verlauf
        </span>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
        >
          <span className={'inline-flex transition-transform ' + (addOpen ? 'rotate-45' : '')}>
            <PlusIcon className="w-3.5 h-3.5" />
          </span>
          {addOpen ? 'Schließen' : 'Eintrag'}
        </button>
      </div>

      {addOpen && (
        <AddActivityForm
          onSubmit={async (input) => {
            await onAddActivity(input);
            setAddOpen(false);
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}

      {items.length === 0 && !addOpen && (
        <div className="text-xs text-slate-400 italic py-2">
          Noch keine Einträge. Klicke „Eintrag" für Anruf, Notiz, E-Mail oder Termin.
        </div>
      )}

      {items.length > 0 && (
        <ol className="mt-3">
          {items.map((item, i) => (
            <TimelineRow
              key={itemKey(item)}
              item={item}
              isLast={i === items.length - 1}
              onDeleteActivity={onDeleteActivity}
              onUnlinkMeeting={onUnlinkMeeting}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function itemKey(item: TimelineItem) {
  return item.kind === 'activity' ? `a-${item.activity.id}` : `m-${item.meeting.id}`;
}

function TimelineDot({ state }: { state: MeetingState }) {
  if (state === 'past') {
    return (
      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white grid place-items-center">
        <CheckIcon className="w-2.5 h-2.5" />
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span className="w-4 h-4 rounded-full bg-white border-2 border-slate-300 grid place-items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded-full bg-white border-2 border-slate-300" />
  );
}

function TimelineRow({
  item,
  isLast,
  onDeleteActivity,
  onUnlinkMeeting
}: {
  item: TimelineItem;
  isLast: boolean;
  onDeleteActivity: (id: string) => Promise<void>;
  onUnlinkMeeting?: (id: string) => Promise<void>;
}) {
  return (
    <li className="grid grid-cols-[16px_1fr] gap-x-3">
      <div className="flex flex-col items-center">
        <div className="pt-1">
          <TimelineDot state={item.state} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
      </div>
      <div className={isLast ? '' : 'pb-4'}>
        {item.kind === 'meeting' ? (
          <MeetingContent item={item} onUnlinkMeeting={onUnlinkMeeting} />
        ) : (
          <ActivityContent item={item} onDeleteActivity={onDeleteActivity} />
        )}
      </div>
    </li>
  );
}

function MeetingContent({
  item,
  onUnlinkMeeting
}: {
  item: Extract<TimelineItem, { kind: 'meeting' }>;
  onUnlinkMeeting?: (id: string) => Promise<void>;
}) {
  const m = item.meeting;
  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <TypeBadge type="meeting" running={item.state === 'running'} />
          {m.matchMode === 'auto' && (
            <span className="text-[10px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5 py-0.5">
              auto
            </span>
          )}
        </div>
        <div className="text-sm text-slate-900 font-medium break-words">
          {m.topic || 'Zoom-Meeting'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {m.startTime && fmtDate(Date.parse(m.startTime))}
          {' · '}
          {m.duration} Min.
        </div>
      </div>
      <div className="flex items-center gap-1 flex-none opacity-70 group-hover:opacity-100 transition-opacity">
        {m.joinUrl && (item.state === 'upcoming' || item.state === 'running') && (
          <a
            href={m.joinUrl}
            target="_blank"
            rel="noreferrer"
            className={
              'text-xs px-2 py-1 rounded font-medium whitespace-nowrap ' +
              (item.state === 'running'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50')
            }
          >
            {item.state === 'running' ? 'Jetzt beitreten' : 'Join'}
          </a>
        )}
        {onUnlinkMeeting && (
          <button
            type="button"
            onClick={() => onUnlinkMeeting(m.id)}
            className="text-slate-400 hover:text-rose-600 w-6 h-6 grid place-items-center rounded hover:bg-rose-50"
            title="Verknüpfung lösen"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ActivityContent({
  item,
  onDeleteActivity
}: {
  item: Extract<TimelineItem, { kind: 'activity' }>;
  onDeleteActivity: (id: string) => Promise<void>;
}) {
  const a = item.activity;
  const canDelete = ACTIVITY_TYPE_META[a.type].manual;
  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <TypeBadge type={a.type} />
        </div>
        <div className="text-sm text-slate-900 font-medium break-words">{a.title}</div>
        {a.body && (
          <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</div>
        )}
        <div className="text-xs text-slate-400 mt-0.5">{fmtDate(a.timestamp)}</div>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDeleteActivity(a.id)}
          className="text-slate-400 hover:text-rose-600 w-6 h-6 grid place-items-center rounded hover:bg-rose-50 flex-none opacity-0 group-hover:opacity-100 transition-opacity"
          title="Eintrag löschen"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function TypeBadge({
  type,
  running
}: {
  type: ActivityType | 'meeting';
  running?: boolean;
}) {
  const label = type === 'meeting' ? 'Zoom' : ACTIVITY_TYPE_META[type].label;
  const chip =
    type === 'meeting'
      ? running
        ? 'bg-red-50 text-red-800 ring-red-200'
        : 'bg-indigo-50 text-indigo-700 ring-indigo-200'
      : ACTIVITY_TYPE_META[type].chip;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ring-1 rounded px-1.5 py-0.5 flex-none ${chip}`}
    >
      <ActivityIcon type={type} className="w-3 h-3" />
      {label}
    </span>
  );
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: sameYear ? undefined : '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function AddActivityForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (input: {
    type: ActivityType;
    title: string;
    body?: string;
    timestamp?: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ActivityType>('anruf');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        body: body.trim() || undefined,
        timestamp: dateTime ? new Date(dateTime).getTime() : undefined
      });
    } finally {
      setSaving(false);
    }
  }

  const manualTypes: ActivityType[] = ['anruf', 'email', 'notiz', 'termin'];

  return (
    <form
      onSubmit={submit}
      className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 space-y-3 my-2"
    >
      <div className="flex items-center gap-1 flex-wrap">
        {manualTypes.map((t) => {
          const m = ACTIVITY_TYPE_META[t];
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ring-1 transition-colors ' +
                (active
                  ? m.chip
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
              }
            >
              <ActivityIcon type={t} className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Titel (z.B. Rückruf vereinbart, Erstes Angebot verschickt)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
      />
      <input
        type="datetime-local"
        value={dateTime}
        onChange={(e) => setDateTime(e.target.value)}
        className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
      />
      <textarea
        placeholder="Notizen (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white resize-y"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}

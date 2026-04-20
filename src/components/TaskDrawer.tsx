import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NewTask, Origin, Task } from '../types';
import { XIcon } from './Icons';

interface Props {
  owner: Origin;
  initial: Task | null;
  defaultDate?: string;
  currentUserOrigin: Origin | null;
  onClose: () => void;
  onSave: (input: NewTask, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onToggleDone?: (id: string, done: boolean, by: Origin) => Promise<void>;
}

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTime(s: string): string {
  return new Date(s).toISOString();
}

function defaultStart(dateKey?: string): string {
  if (dateKey) return `${dateKey}T09:00`;
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultEnd(start: string): string {
  const d = new Date(start);
  d.setMinutes(d.getMinutes() + 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskDrawer({
  owner,
  initial,
  defaultDate,
  currentUserOrigin,
  onClose,
  onSave,
  onDelete,
  onToggleDone
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [startAt, setStartAt] = useState(
    initial ? toLocalDateTime(initial.startAt) : defaultStart(defaultDate)
  );
  const [endAt, setEndAt] = useState(
    initial ? toLocalDateTime(initial.endAt) : defaultEnd(defaultStart(defaultDate))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setErr('Titel fehlt');
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setErr('Ende muss nach Start liegen');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(
        {
          owner,
          title: title.trim(),
          body: body.trim() || undefined,
          startAt: fromLocalDateTime(startAt),
          endAt: fromLocalDateTime(endAt)
        },
        initial?.id
      );
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial || !onDelete) return;
    if (!confirm(`„${initial.title}" löschen?`)) return;
    try {
      await onDelete(initial.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <form
        onSubmit={submit}
        className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Task bearbeiten' : 'Neue Task'}
          </h2>
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
          {initial?.done && (
            <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>
                Erledigt
                {initial.doneBy ? ` von ${initial.doneBy}` : ''}
                {initial.doneAt
                  ? ` · ${new Date(initial.doneAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
                  : ''}
              </span>
            </div>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
              Titel
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="z.B. Angebot vorbereiten"
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                Start
              </span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => {
                  setStartAt(e.target.value);
                  if (new Date(endAt) <= new Date(e.target.value)) {
                    setEndAt(defaultEnd(e.target.value));
                  }
                }}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                Ende
              </span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
              Notizen
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Optional"
              className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white resize-y"
            />
          </label>

          {err && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
              {err}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 flex-wrap">
            {initial && onToggleDone && (
              <button
                type="button"
                onClick={async () => {
                  const by = currentUserOrigin || initial.owner;
                  await onToggleDone(initial.id, !initial.done, by);
                  onClose();
                }}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors ' +
                  (initial.done
                    ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                    : 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100')
                }
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {initial.done ? 'Wieder offen' : 'Als erledigt markieren'}
              </button>
            )}
            {initial && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Löschen
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? 'Speichere…' : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}

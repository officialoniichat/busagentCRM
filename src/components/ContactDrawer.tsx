import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent, ReactNode } from 'react';
import type { Activity, ActivityType, Contact, ContactFile, Meeting, NewContact, Origin, Stufe } from '../types';
import { EMPTY_CONTACT, ORIGIN_META, STUFE_META, pickEditableFields } from '../types';
import ContactTimeline from './ContactTimeline';

interface Props {
  initial: Contact | null;
  initialDraft?: Partial<NewContact>;
  titleOverride?: string;
  meetings?: Meeting[];
  activities?: Activity[];
  onClose: () => void;
  onSave: (input: NewContact, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onUnlinkMeeting?: (meetingId: string) => Promise<void>;
  onAddActivity?: (input: {
    type: ActivityType;
    title: string;
    body?: string;
    timestamp?: number;
  }) => Promise<void>;
  onDeleteActivity?: (activityId: string) => Promise<void>;
  files?: ContactFile[];
  onUploadFile?: (file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  downloadUrlFor?: (fileId: string) => string;
}

export default function ContactDrawer({
  initial,
  initialDraft,
  titleOverride,
  meetings = [],
  activities = [],
  onClose,
  onSave,
  onDelete,
  onUnlinkMeeting,
  onAddActivity,
  onDeleteActivity,
  files = [],
  onUploadFile,
  onDeleteFile,
  downloadUrlFor
}: Props) {
  const [form, setForm] = useState<NewContact>(() =>
    initial
      ? pickEditableFields(initial)
      : { ...EMPTY_CONTACT, ...(initialDraft || {}) }
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

  function update<K extends keyof NewContact>(key: K, value: NewContact[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await onSave(form, initial?.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    const label = initial.name || initial.unternehmen || 'dieser Kontakt';
    if (!confirm(`„${label}" wirklich löschen?`)) return;
    try {
      await onDelete(initial.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-30">
      <div
        className="absolute inset-0 bg-slate-900/30"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {titleOverride ?? (initial ? 'Kontakt bearbeiten' : 'Neuer Kontakt')}
            </h2>
            {initial && (
              <p className="text-xs text-slate-500 mt-0.5">
                Zuletzt aktualisiert:{' '}
                {new Date(initial.updatedAt).toLocaleString('de-DE', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Schließen"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Unternehmen">
            <input
              value={form.unternehmen}
              onChange={(e) => update('unternehmen', e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefon">
              <input
                value={form.telefon}
                onChange={(e) => update('telefon', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="E-Mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Website">
            <div className="relative">
              <input
                value={form.web}
                onChange={(e) => update('web', e.target.value)}
                className={inputCls + (form.web.trim() ? ' pr-10' : '')}
                placeholder="z.B. example.de"
              />
              {form.web.trim() && (
                <a
                  href={normalizeUrl(form.web)}
                  target="_blank"
                  rel="noreferrer"
                  title="Website öffnen"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-md text-indigo-600 hover:bg-indigo-50"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                  </svg>
                </a>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fahrer">
              <input
                value={form.fahrer}
                onChange={(e) => update('fahrer', e.target.value)}
                className={inputCls}
                placeholder="z.B. 16 oder ca. 100"
              />
            </Field>
            <Field label="Fahrzeuge">
              <input
                value={form.fahrzeuge}
                onChange={(e) => update('fahrzeuge', e.target.value)}
                className={inputCls}
                placeholder="z.B. 12 oder groß"
              />
            </Field>
          </div>

          <Field label="Verkehrsarten" hint='L (Linie) · A (Anmiet) · T (Touristik)'>
            <input
              value={form.verkehrsarten}
              onChange={(e) => update('verkehrsarten', e.target.value)}
              className={inputCls}
              placeholder='z.B. L, A oder Alle'
            />
          </Field>

          <Field label="Termin / Info">
            <input
              value={form.termin}
              onChange={(e) => update('termin', e.target.value)}
              className={inputCls}
              placeholder="z.B. 20.05.2026 — 14:00"
            />
          </Field>

          <Field label="Notizen">
            <textarea
              value={form.notizen}
              onChange={(e) => update('notizen', e.target.value)}
              rows={5}
              className={inputCls + ' resize-y min-h-[100px]'}
            />
          </Field>

          {initial && onAddActivity && onDeleteActivity && (
            <ContactTimeline
              activities={activities}
              meetings={meetings}
              onAddActivity={onAddActivity}
              onDeleteActivity={onDeleteActivity}
              onUnlinkMeeting={onUnlinkMeeting}
            />
          )}

          {initial && onUploadFile && onDeleteFile && downloadUrlFor && (
            <FilesSection
              files={files}
              onUpload={onUploadFile}
              onDelete={onDeleteFile}
              downloadUrlFor={downloadUrlFor}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Stufe">
              <div className="flex gap-2 flex-wrap">
                {(['K', 'V', 'T'] as Stufe[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('stufe', s)}
                    className={pickChipCls(form.stufe === s, STUFE_META[s].chip)}
                  >
                    {STUFE_META[s].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Origin">
              <div className="flex gap-2 flex-wrap">
                {(['F', 'T'] as Origin[]).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => update('origin', o)}
                    className={pickChipCls(form.origin === o, ORIGIN_META[o].chip)}
                  >
                    {ORIGIN_META[o].label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {err && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-sm text-rose-700">
              {err}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          {initial ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
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

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
        </span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white placeholder:text-slate-400';

function pickChipCls(active: boolean, activeCls: string) {
  return (
    'px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition-colors ' +
    (active
      ? activeCls
      : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')
  );
}

function FilesSection({
  files,
  onUpload,
  onDelete,
  downloadUrlFor
}: {
  files: ContactFile[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
  downloadUrlFor: (fileId: string) => string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      await onUpload(file);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setUploading(false);
    }
  }

  const sorted = [...files].sort((a, b) => b.uploadedAt - a.uploadedAt);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">
          Dokumente
        </span>
        <label
          className={
            'text-xs font-medium inline-flex items-center gap-1 cursor-pointer ' +
            (uploading
              ? 'text-slate-400 cursor-wait'
              : 'text-indigo-700 hover:text-indigo-900')
          }
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {uploading ? 'Lädt hoch…' : 'Datei hochladen'}
          <input
            type="file"
            onChange={handlePick}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-2">
          Noch keine Dokumente. Max 25 MB pro Datei.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 ring-1 ring-slate-200 rounded-lg">
          {sorted.map((f) => (
            <li key={f.id} className="px-3 py-2.5 flex items-center gap-3 group">
              <svg
                className="w-5 h-5 text-slate-400 flex-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900 font-medium truncate">{f.name}</div>
                <div className="text-xs text-slate-500">
                  {formatSize(f.size)} ·{' '}
                  {new Date(f.uploadedAt).toLocaleString('de-DE', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </div>
              </div>
              <a
                href={downloadUrlFor(f.id)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50"
              >
                Öffnen
              </a>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`„${f.name}" löschen?`)) onDelete(f.id);
                }}
                className="text-slate-400 hover:text-rose-600 w-6 h-6 grid place-items-center rounded hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Datei löschen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {err && (
        <div className="mt-2 bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2 text-xs text-rose-700">
          {err}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^[a-z][\w+.-]*:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}


export type Stufe = 'K' | 'V' | 'T';
export type Origin = 'F' | 'T';

export interface Contact {
  id: string;
  name: string;
  unternehmen: string;
  telefon: string;
  email: string;
  web: string;
  fahrer: string;
  fahrzeuge: string;
  verkehrsarten: string;
  notizen: string;
  termin: string;
  stufe: Stufe;
  origin: Origin;
  createdAt: number;
  updatedAt: number;
  activities?: Activity[];
  files?: ContactFile[];
}

export type NewContact = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

export const STUFE_META: Record<Stufe, { label: string; chip: string; dot: string }> = {
  K: {
    label: 'Kalt',
    chip: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400'
  },
  V: {
    label: 'Vorschau',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500'
  },
  T: {
    label: 'Testtermin',
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500'
  }
};

export const ORIGIN_META: Record<Origin, { label: string; chip: string }> = {
  F: { label: 'Fabian', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  T: { label: 'Theo', chip: 'bg-rose-50 text-rose-700 ring-rose-200' }
};

export const EMPTY_CONTACT: NewContact = {
  name: '',
  unternehmen: '',
  telefon: '',
  email: '',
  web: '',
  fahrer: '',
  fahrzeuge: '',
  verkehrsarten: '',
  notizen: '',
  termin: '',
  stufe: 'K',
  origin: 'F'
};

export type MatchMode = 'auto' | 'manual' | 'unlinked';

export type MeetingState = 'upcoming' | 'running' | 'past';

export function meetingState(
  startTime: string | null | undefined,
  duration: number
): MeetingState {
  if (!startTime) return 'past';
  const start = Date.parse(startTime);
  const end = start + Math.max(duration || 30, 5) * 60000;
  const now = Date.now();
  if (now < start) return 'upcoming';
  if (now <= end) return 'running';
  return 'past';
}

export type ActivityType =
  | 'kontakt_angelegt'
  | 'stufenwechsel'
  | 'anruf'
  | 'email'
  | 'notiz'
  | 'termin';

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: number;
  createdAt: number;
  title: string;
  body?: string;
  meta?: { fromStufe?: Stufe; toStufe?: Stufe };
}

export const ACTIVITY_TYPE_META: Record<
  ActivityType,
  { label: string; chip: string; manual: boolean }
> = {
  kontakt_angelegt: {
    label: 'Angelegt',
    chip: 'bg-slate-100 text-slate-700 ring-slate-200',
    manual: false
  },
  stufenwechsel: {
    label: 'Stufenwechsel',
    chip: 'bg-violet-50 text-violet-800 ring-violet-200',
    manual: false
  },
  anruf: {
    label: 'Anruf',
    chip: 'bg-sky-50 text-sky-800 ring-sky-200',
    manual: true
  },
  email: {
    label: 'E-Mail',
    chip: 'bg-teal-50 text-teal-800 ring-teal-200',
    manual: true
  },
  notiz: {
    label: 'Notiz',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    manual: true
  },
  termin: {
    label: 'Termin',
    chip: 'bg-rose-50 text-rose-800 ring-rose-200',
    manual: true
  }
};

export interface Meeting {
  id: string;
  zoomId: number;
  uuid: string;
  topic: string;
  agenda: string;
  startTime: string | null;
  duration: number;
  timezone: string;
  joinUrl: string;
  hostId: string;
  type: number;
  createdAt: string | null;
  syncedAt: number;
  contactId?: string;
  matchMode: MatchMode;
  matchScore?: number;
  assignedSellers?: Origin[];
  reviewed?: boolean;
  reviewedAt?: number;
  reviewOutcome?: 'happened' | 'noshow';
}

export interface ContactFile {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  size: number;
  uploadedAt: number;
}

export interface NewMeeting {
  topic: string;
  startTime: string;
  duration: number;
  timezone?: string;
  agenda?: string;
  contactId?: string;
  assignedSellers?: Origin[];
}

export interface Task {
  id: string;
  owner: Origin;
  title: string;
  body?: string;
  startAt: string;
  endAt: string;
  createdAt: number;
  updatedAt: number;
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export interface SyncStatus {
  configured: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  syncing: boolean;
}

export type VorschauHighlight = 'needs-files' | 'has-files' | null;

export function vorschauHighlight(
  contact: Pick<Contact, 'stufe' | 'files'> | null | undefined
): VorschauHighlight {
  if (!contact || contact.stufe !== 'V') return null;
  return (contact.files?.length || 0) > 0 ? 'has-files' : 'needs-files';
}

export function pickEditableFields(c: Contact): NewContact {
  return {
    name: c.name,
    unternehmen: c.unternehmen,
    telefon: c.telefon,
    email: c.email,
    web: c.web,
    fahrer: c.fahrer,
    fahrzeuge: c.fahrzeuge,
    verkehrsarten: c.verkehrsarten,
    notizen: c.notizen,
    termin: c.termin,
    stufe: c.stufe,
    origin: c.origin
  };
}

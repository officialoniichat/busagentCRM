import type { Activity, ActivityType, Contact, Meeting, NewContact, NewMeeting, NewTask, Origin, SyncStatus, Task } from './types';

const base = '/api';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? ' — ' + text : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listContacts(): Promise<Contact[]> {
  return fetch(`${base}/contacts`).then((r) => handle<Contact[]>(r));
}

export function createContact(contact: NewContact): Promise<Contact> {
  return fetch(`${base}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact)
  }).then((r) => handle<Contact>(r));
}

export function updateContact(id: string, patch: Partial<NewContact>): Promise<Contact> {
  return fetch(`${base}/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  }).then((r) => handle<Contact>(r));
}

export function deleteContact(id: string): Promise<void> {
  return fetch(`${base}/contacts/${id}`, { method: 'DELETE' }).then((r) =>
    handle<void>(r)
  );
}

export function addActivity(
  contactId: string,
  input: { type: ActivityType; title: string; body?: string; timestamp?: number }
): Promise<Activity> {
  return fetch(`${base}/contacts/${contactId}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  }).then((r) => handle<Activity>(r));
}

export function deleteActivity(contactId: string, activityId: string): Promise<void> {
  return fetch(`${base}/contacts/${contactId}/activities/${activityId}`, {
    method: 'DELETE'
  }).then((r) => handle<void>(r));
}

export function listMeetings(): Promise<Meeting[]> {
  return fetch(`${base}/meetings`).then((r) => handle<Meeting[]>(r));
}

export function createMeeting(input: NewMeeting): Promise<Meeting> {
  return fetch(`${base}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  }).then((r) => handle<Meeting>(r));
}

export function linkMeeting(id: string, contactId: string | null): Promise<Meeting> {
  return fetch(`${base}/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId })
  }).then((r) => handle<Meeting>(r));
}

export function setMeetingSellers(id: string, assignedSellers: Origin[]): Promise<Meeting> {
  return fetch(`${base}/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedSellers })
  }).then((r) => handle<Meeting>(r));
}

export function listTasks(): Promise<Task[]> {
  return fetch(`${base}/tasks`).then((r) => handle<Task[]>(r));
}

export function createTask(task: NewTask): Promise<Task> {
  return fetch(`${base}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task)
  }).then((r) => handle<Task>(r));
}

export function updateTask(id: string, patch: Partial<NewTask>): Promise<Task> {
  return fetch(`${base}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  }).then((r) => handle<Task>(r));
}

export function deleteTask(id: string): Promise<void> {
  return fetch(`${base}/tasks/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r));
}

export function getZoomStatus(): Promise<SyncStatus> {
  return fetch(`${base}/zoom/status`).then((r) => handle<SyncStatus>(r));
}

export function triggerSync(): Promise<{
  total: number;
  added: number;
  updated: number;
  removed: number;
  autoLinked: number;
  at: number;
}> {
  return fetch(`${base}/zoom/sync`, { method: 'POST' }).then((r) => handle(r));
}

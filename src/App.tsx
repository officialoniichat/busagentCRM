import { useCallback, useEffect, useState } from 'react';
import type { Contact, Meeting, NewContact, NewMeeting, NewTask, SyncStatus, Task } from './types';
import * as api from './api';
import Header from './components/Header';
import type { TabName } from './components/Header';
import ContactsView from './components/ContactsView';
import CalendarView from './components/CalendarView';
import TasksView from './components/TasksView';
import OpenView from './components/OpenView';
import { meetingState } from './types';

type Tab = TabName;

export default function App() {
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.listContacts(),
      api.listMeetings(),
      api.listTasks(),
      api.getZoomStatus()
    ])
      .then(([cs, ms, ts, st]) => {
        setContacts(cs);
        setMeetings(ms);
        setTasks(ts);
        setStatus(st);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const refreshMeetings = useCallback(async () => {
    const ms = await api.listMeetings();
    setMeetings(ms);
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatus(await api.getZoomStatus());
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      await Promise.all([refreshMeetings(), refreshStatus()]);
    } catch (e) {
      alert('Sync-Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  }, [refreshMeetings, refreshStatus]);

  const handleSaveContact = useCallback(
    async (input: NewContact, id?: string) => {
      if (id) {
        const updated = await api.updateContact(id, input);
        setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
        return updated;
      }
      const created = await api.createContact(input);
      setContacts((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const handleDeleteContact = useCallback(async (id: string) => {
    await api.deleteContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await refreshMeetings();
  }, [refreshMeetings]);

  const handleAddActivity = useCallback(
    async (
      contactId: string,
      input: {
        type: import('./types').ActivityType;
        title: string;
        body?: string;
        timestamp?: number;
      }
    ) => {
      const activity = await api.addActivity(contactId, input);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, activities: [...(c.activities || []), activity] }
            : c
        )
      );
    },
    []
  );

  const handleDeleteActivity = useCallback(
    async (contactId: string, activityId: string) => {
      await api.deleteActivity(contactId, activityId);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, activities: (c.activities || []).filter((a) => a.id !== activityId) }
            : c
        )
      );
    },
    []
  );

  const handleUploadFile = useCallback(
    async (contactId: string, file: File) => {
      const meta = await api.uploadContactFile(contactId, file);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, files: [...(c.files || []), meta] }
            : c
        )
      );
    },
    []
  );

  const handleDeleteFile = useCallback(
    async (contactId: string, fileId: string) => {
      await api.deleteContactFile(contactId, fileId);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, files: (c.files || []).filter((f) => f.id !== fileId) }
            : c
        )
      );
    },
    []
  );

  const handleLinkMeeting = useCallback(
    async (meetingId: string, contactId: string | null) => {
      const updated = await api.linkMeeting(meetingId, contactId);
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updated : m)));
    },
    []
  );

  const handleSetSellers = useCallback(
    async (meetingId: string, sellers: import('./types').Origin[]) => {
      const updated = await api.setMeetingSellers(meetingId, sellers);
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updated : m)));
    },
    []
  );

  const handleDeleteMeeting = useCallback(async (meetingId: string) => {
    await api.deleteMeeting(meetingId);
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  }, []);

  const handleReviewMeeting = useCallback(
    async (
      meetingId: string,
      input: {
        outcome: 'happened' | 'noshow';
        newStufe?: 'K' | 'V' | 'T';
        note?: string;
      }
    ) => {
      const updated = await api.reviewMeeting(meetingId, input);
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updated : m)));
      if (input.outcome === 'happened' && updated.contactId) {
        const fresh = await api.listContacts();
        setContacts(fresh);
      }
    },
    []
  );

  const openCount = meetings.filter(
    (m) =>
      m.contactId &&
      !m.reviewed &&
      m.startTime &&
      meetingState(m.startTime, m.duration) === 'past'
  ).length;

  const handleCreateMeeting = useCallback(async (input: NewMeeting) => {
    const created = await api.createMeeting(input);
    setMeetings((prev) => {
      const idx = prev.findIndex((m) => m.id === created.id);
      if (idx !== -1) {
        const next = prev.slice();
        next[idx] = created;
        return next;
      }
      return [...prev, created];
    });
    return created;
  }, []);

  const handleCreateTask = useCallback(async (input: NewTask) => {
    const created = await api.createTask(input);
    setTasks((prev) => [...prev, created]);
    return created;
  }, []);

  const handleUpdateTask = useCallback(async (id: string, patch: Partial<NewTask>) => {
    const updated = await api.updateTask(id, patch);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="min-h-screen">
      <Header
        tab={tab}
        onTabChange={setTab}
        onAddContact={() => setNewContactOpen(true)}
        onSync={handleSync}
        syncing={syncing}
        status={status}
        openCount={openCount}
      />

      {loading ? (
        <div className="max-w-7xl mx-auto px-6 py-16 text-center text-slate-500">
          Lädt…
        </div>
      ) : error ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-6 text-rose-700">
            <strong>Fehler:</strong> {error}
          </div>
        </div>
      ) : tab === 'contacts' ? (
        <ContactsView
          contacts={contacts}
          meetings={meetings}
          newContactOpen={newContactOpen}
          onNewContactClose={() => setNewContactOpen(false)}
          onSave={handleSaveContact}
          onDelete={handleDeleteContact}
          onLinkMeeting={handleLinkMeeting}
          onAddActivity={handleAddActivity}
          onDeleteActivity={handleDeleteActivity}
          onUploadFile={handleUploadFile}
          onDeleteFile={handleDeleteFile}
        />
      ) : tab === 'calendar' ? (
        <CalendarView
          meetings={meetings}
          contacts={contacts}
          onLinkMeeting={handleLinkMeeting}
          onCreateContact={handleSaveContact}
          onSetSellers={handleSetSellers}
          onCreateMeeting={handleCreateMeeting}
          onDeleteMeeting={handleDeleteMeeting}
        />
      ) : tab === 'open' ? (
        <OpenView
          meetings={meetings}
          contacts={contacts}
          onReview={handleReviewMeeting}
        />
      ) : (
        <TasksView
          meetings={meetings}
          contacts={contacts}
          tasks={tasks}
          onLinkMeeting={handleLinkMeeting}
          onSetSellers={handleSetSellers}
          onDeleteMeeting={handleDeleteMeeting}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import * as zoom from './zoom.mjs';
import { matchContactForTopic } from './match.mjs';
import { getDb, FieldValue } from './firestore.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3001;
const SYNC_INTERVAL_MS = 10 * 60 * 1000;

async function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const buf = await fs.readFile(envPath, 'utf8');
    for (const raw of buf.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
await loadEnv();

const db = getDb();
const cContacts = db.collection('contacts');
const cMeetings = db.collection('meetings');
const cTasks = db.collection('tasks');

const STUFE_LABEL = { K: 'Kalt', V: 'Vorschau', T: 'Testtermin' };

function sanitizeContact(body) {
  const fields = [
    'name', 'unternehmen', 'telefon', 'email', 'web',
    'fahrer', 'fahrzeuge', 'verkehrsarten', 'notizen', 'termin',
    'stufe', 'origin'
  ];
  const out = {};
  for (const f of fields) {
    if (typeof body[f] === 'string') out[f] = body[f];
  }
  return out;
}

function sanitizeTask(body) {
  const out = {};
  if (body.owner === 'F' || body.owner === 'T') out.owner = body.owner;
  if (typeof body.title === 'string') out.title = body.title.trim();
  if (typeof body.body === 'string') out.body = body.body.trim();
  if (typeof body.startAt === 'string') out.startAt = body.startAt;
  if (typeof body.endAt === 'string') out.endAt = body.endAt;
  return out;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- Contacts ----------

app.get('/api/contacts', async (_req, res) => {
  try {
    const snap = await cContacts.get();
    res.json(snap.docs.map((d) => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const now = Date.now();
    const contact = {
      id,
      createdAt: now,
      updatedAt: now,
      name: '', unternehmen: '', telefon: '', email: '', web: '',
      fahrer: '', fahrzeuge: '', verkehrsarten: '', notizen: '', termin: '',
      stufe: 'K', origin: 'F',
      ...sanitizeContact(req.body),
      activities: [
        {
          id: crypto.randomUUID(),
          type: 'kontakt_angelegt',
          timestamp: now,
          createdAt: now,
          title: 'Kontakt angelegt'
        }
      ]
    };
    await cContacts.doc(id).set(contact);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    const ref = cContacts.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const prev = snap.data();
    const patch = sanitizeContact(req.body);
    const now = Date.now();
    const updates = { ...patch, updatedAt: now };
    if (patch.stufe && patch.stufe !== prev.stufe) {
      const activity = {
        id: crypto.randomUUID(),
        type: 'stufenwechsel',
        timestamp: now,
        createdAt: now,
        title: `Stufe: ${STUFE_LABEL[prev.stufe] || prev.stufe} → ${STUFE_LABEL[patch.stufe] || patch.stufe}`,
        meta: { fromStufe: prev.stufe, toStufe: patch.stufe }
      };
      updates.activities = FieldValue.arrayUnion(activity);
    }
    await ref.update(updates);
    const next = (await ref.get()).data();
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/contacts/:id/activities', async (req, res) => {
  try {
    const ref = cContacts.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const { type, title, body, timestamp } = req.body || {};
    const allowed = ['anruf', 'email', 'notiz', 'termin'];
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: 'Invalid activity type' });
    }
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title required' });
    }
    const now = Date.now();
    const activity = {
      id: crypto.randomUUID(),
      type,
      timestamp: Number(timestamp) || now,
      createdAt: now,
      title: title.trim(),
      ...(typeof body === 'string' && body.trim() ? { body: body.trim() } : {})
    };
    await ref.update({
      activities: FieldValue.arrayUnion(activity),
      updatedAt: now
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete('/api/contacts/:id/activities/:aid', async (req, res) => {
  try {
    const ref = cContacts.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data();
    const filtered = (data.activities || []).filter((a) => a.id !== req.params.aid);
    await ref.update({ activities: filtered, updatedAt: Date.now() });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const ref = cContacts.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    await ref.delete();
    const linked = await cMeetings.where('contactId', '==', req.params.id).get();
    if (!linked.empty) {
      const batch = db.batch();
      for (const doc of linked.docs) {
        batch.update(doc.ref, {
          contactId: FieldValue.delete(),
          matchMode: 'unlinked'
        });
      }
      await batch.commit();
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------- Meetings ----------

app.get('/api/meetings', async (_req, res) => {
  try {
    const snap = await cMeetings.get();
    res.json(snap.docs.map((d) => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/meetings', async (req, res) => {
  if (!zoom.hasCredentials()) {
    return res.status(503).json({ error: 'Zoom nicht konfiguriert' });
  }
  const body = req.body || {};
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';
  const duration = Number(body.duration);
  if (!topic) return res.status(400).json({ error: 'topic required' });
  if (!startTime) return res.status(400).json({ error: 'startTime required' });
  if (!Number.isFinite(duration) || duration < 1) {
    return res.status(400).json({ error: 'duration (minutes) required' });
  }
  const timezone = typeof body.timezone === 'string' && body.timezone
    ? body.timezone
    : 'Europe/Berlin';
  const agenda = typeof body.agenda === 'string' ? body.agenda : '';
  const contactId = typeof body.contactId === 'string' && body.contactId
    ? body.contactId
    : null;

  let assignedSellers = [];
  if (Array.isArray(body.assignedSellers)) {
    if (body.assignedSellers.some((s) => s !== 'F' && s !== 'T')) {
      return res.status(400).json({ error: 'assignedSellers must be F|T' });
    }
    assignedSellers = [...new Set(body.assignedSellers)];
  }

  if (contactId) {
    const csnap = await cContacts.doc(contactId).get();
    if (!csnap.exists) {
      return res.status(400).json({ error: 'contactId not found' });
    }
  }

  const payload = {
    topic,
    type: 2,
    start_time: startTime,
    duration: Math.round(duration),
    timezone,
    agenda,
    settings: {
      host_video: true,
      participant_video: true,
      audio: 'both',
      join_before_host: false,
      mute_upon_entry: false
    }
  };

  let created;
  try {
    created = await zoom.createMeeting(payload);
  } catch (err) {
    return res.status(502).json({ error: err.message || String(err) });
  }

  const id = String(created.id);
  const meeting = {
    id,
    zoomId: created.id,
    uuid: created.uuid || '',
    topic: created.topic || topic,
    agenda: created.agenda || agenda,
    startTime: created.start_time || startTime,
    duration: created.duration || Math.round(duration),
    timezone: created.timezone || timezone,
    joinUrl: created.join_url || '',
    hostId: created.host_id || '',
    type: created.type || 2,
    createdAt: created.created_at || new Date().toISOString(),
    syncedAt: Date.now(),
    matchMode: contactId ? 'manual' : 'unlinked'
  };
  if (contactId) meeting.contactId = contactId;
  if (assignedSellers.length > 0) meeting.assignedSellers = assignedSellers;

  await cMeetings.doc(id).set(meeting, { merge: true });
  const stored = (await cMeetings.doc(id).get()).data();
  res.status(201).json(stored);
});

app.delete('/api/meetings/:id', async (req, res) => {
  try {
    const ref = cMeetings.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    if (zoom.hasCredentials()) {
      try {
        await zoom.deleteMeeting(req.params.id);
      } catch (err) {
        if (err.status !== 404) {
          return res.status(502).json({ error: err.message || String(err) });
        }
      }
    }
    await ref.delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.patch('/api/meetings/:id', async (req, res) => {
  try {
    const ref = cMeetings.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const updates = {};
    if ('contactId' in req.body) {
      const cid = req.body.contactId;
      if (cid === null || cid === '') {
        updates.contactId = FieldValue.delete();
        updates.matchMode = 'unlinked';
      } else {
        const csnap = await cContacts.doc(cid).get();
        if (!csnap.exists) return res.status(400).json({ error: 'contactId not found' });
        updates.contactId = cid;
        updates.matchMode = 'manual';
      }
    }
    if ('assignedSellers' in req.body) {
      const val = req.body.assignedSellers;
      if (!Array.isArray(val) || val.some((s) => s !== 'F' && s !== 'T')) {
        return res.status(400).json({ error: 'assignedSellers must be array of F|T' });
      }
      updates.assignedSellers = [...new Set(val)];
    }
    await ref.update(updates);
    const next = (await ref.get()).data();
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------- Tasks ----------

app.get('/api/tasks', async (_req, res) => {
  try {
    const snap = await cTasks.get();
    res.json(snap.docs.map((d) => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const input = sanitizeTask(req.body);
    if (!input.owner || !input.title || !input.startAt || !input.endAt) {
      return res.status(400).json({ error: 'owner, title, startAt, endAt required' });
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const task = { id, createdAt: now, updatedAt: now, ...input };
    await cTasks.doc(id).set(task);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const ref = cTasks.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    await ref.update({ ...sanitizeTask(req.body), updatedAt: Date.now() });
    const next = (await ref.get()).data();
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await cTasks.doc(req.params.id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------- Zoom sync ----------

const state = {
  lastSyncAt: null,
  lastSyncError: null,
  syncing: false
};

app.get('/api/zoom/status', (_req, res) => {
  res.json({
    configured: zoom.hasCredentials(),
    lastSyncAt: state.lastSyncAt,
    lastSyncError: state.lastSyncError,
    syncing: state.syncing
  });
});

app.post('/api/zoom/sync', async (_req, res) => {
  try {
    const result = await syncMeetings();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

async function syncMeetings() {
  if (!zoom.hasCredentials()) {
    throw new Error(
      'Zoom-Credentials fehlen. Lege .env mit ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET an.'
    );
  }
  if (state.syncing) return { skipped: 'already running' };
  state.syncing = true;
  state.lastSyncError = null;
  try {
    const [remote, existingSnap, contactsSnap] = await Promise.all([
      zoom.listMeetings(),
      cMeetings.get(),
      cContacts.get()
    ]);
    const existingById = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
    const contacts = contactsSnap.docs.map((d) => d.data());

    let added = 0;
    let updated = 0;
    let autoLinked = 0;
    const remoteIds = new Set();
    const now = Date.now();

    const writes = [];
    for (const r of remote) {
      const id = String(r.id);
      remoteIds.add(id);
      const prev = existingById.get(id);

      const merged = {
        id,
        zoomId: r.id,
        uuid: r.uuid,
        topic: r.topic || '',
        agenda: r.agenda || '',
        startTime: r.start_time || null,
        duration: r.duration || 0,
        timezone: r.timezone || 'Europe/Berlin',
        joinUrl: r.join_url || '',
        hostId: r.host_id || '',
        type: r.type,
        createdAt: r.created_at || null,
        syncedAt: now,
        matchMode: prev?.matchMode || 'unlinked'
      };
      if (prev?.contactId) merged.contactId = prev.contactId;
      if (prev?.assignedSellers) merged.assignedSellers = prev.assignedSellers;

      if (!merged.contactId || merged.matchMode === 'auto') {
        const m = matchContactForTopic(merged.topic, contacts);
        if (m) {
          merged.contactId = m.contactId;
          merged.matchMode = 'auto';
          merged.matchScore = m.score;
          if (!prev?.contactId) autoLinked++;
        } else if (merged.matchMode === 'auto') {
          delete merged.contactId;
          merged.matchMode = 'unlinked';
        }
      }

      if (!prev) added++;
      else {
        const prevSig = JSON.stringify({ ...prev, syncedAt: 0 });
        const mergedSig = JSON.stringify({ ...merged, syncedAt: 0 });
        if (prevSig !== mergedSig) updated++;
      }
      writes.push(merged);
    }

    const removals = [...existingById.keys()].filter((id) => !remoteIds.has(id));

    for (let i = 0; i < writes.length; i += 400) {
      const chunk = writes.slice(i, i + 400);
      const batch = db.batch();
      for (const m of chunk) {
        batch.set(cMeetings.doc(m.id), m, { merge: true });
      }
      await batch.commit();
    }
    for (let i = 0; i < removals.length; i += 400) {
      const chunk = removals.slice(i, i + 400);
      const batch = db.batch();
      for (const id of chunk) batch.delete(cMeetings.doc(id));
      await batch.commit();
    }

    state.lastSyncAt = now;
    const summary = {
      total: remote.length,
      added,
      updated,
      removed: removals.length,
      autoLinked,
      at: now
    };
    console.log('[zoom-sync]', summary);
    return summary;
  } catch (err) {
    state.lastSyncError = err.message || String(err);
    console.error('[zoom-sync] error:', state.lastSyncError);
    throw err;
  } finally {
    state.syncing = false;
  }
}

// ---------- Static / SPA ----------

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '..', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✓ CRM API läuft auf http://localhost:${PORT}`);
  if (zoom.hasCredentials()) {
    console.log('✓ Zoom Credentials gefunden — starte initialen Sync');
    syncMeetings().catch(() => {});
    setInterval(() => {
      syncMeetings().catch(() => {});
    }, SYNC_INTERVAL_MS);
  } else {
    console.log('⚠ Keine Zoom-Credentials in .env — Kalender bleibt leer');
  }
});

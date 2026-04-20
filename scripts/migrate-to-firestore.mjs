import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../server/firestore.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function main() {
  await loadEnv();
  const dataPath = path.join(__dirname, '..', 'server', 'data.json');
  const raw = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const contacts = raw.contacts || [];
  const meetings = raw.meetings || [];
  const tasks = raw.tasks || [];

  const db = getDb();
  const cContacts = db.collection('contacts');
  const cMeetings = db.collection('meetings');
  const cTasks = db.collection('tasks');

  console.log(`→ Migriere: ${contacts.length} Kontakte · ${meetings.length} Meetings · ${tasks.length} Tasks`);

  async function commitChunks(items, coll, idKey = 'id') {
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = db.batch();
      for (const item of chunk) {
        const id = String(item[idKey]);
        batch.set(coll.doc(id), item, { merge: true });
      }
      await batch.commit();
      process.stdout.write('.');
    }
  }

  await commitChunks(contacts, cContacts);
  console.log(' contacts ✓');
  await commitChunks(meetings, cMeetings);
  console.log(' meetings ✓');
  await commitChunks(tasks, cTasks);
  console.log(' tasks ✓');

  const [c, m, t] = await Promise.all([cContacts.get(), cMeetings.get(), cTasks.get()]);
  console.log(`\nIn Firestore: ${c.size} contacts · ${m.size} meetings · ${t.size} tasks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

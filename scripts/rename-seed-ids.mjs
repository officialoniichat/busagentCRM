import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
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
await loadEnv();

const SEED_PREFIX = '11111111-1111-4111-8111-';

const db = getDb();
const cContacts = db.collection('contacts');
const cMeetings = db.collection('meetings');

const snap = await cContacts.get();
const renames = [];
for (const doc of snap.docs) {
  const data = doc.data();
  if (typeof data.id === 'string' && data.id.startsWith(SEED_PREFIX)) {
    renames.push({ oldId: data.id, newId: crypto.randomUUID(), data });
  }
}

console.log(`→ ${renames.length} Kontakte zu renamen`);

for (const r of renames) {
  const newData = { ...r.data, id: r.newId };
  await cContacts.doc(r.newId).set(newData);

  const linked = await cMeetings.where('contactId', '==', r.oldId).get();
  if (!linked.empty) {
    const batch = db.batch();
    for (const m of linked.docs) batch.update(m.ref, { contactId: r.newId });
    await batch.commit();
  }

  await cContacts.doc(r.oldId).delete();
  console.log(`${r.data.name.padEnd(24)} ${r.oldId.slice(-12)} → ${r.newId.slice(0, 8)}…  (${linked.size} meetings umgehängt)`);
}

console.log('\n✓ fertig');

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveCredentials() {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  const candidates = [
    path.join(__dirname, '..', 'serviceKey.json'),
    path.join(__dirname, '..', 'serviceAccount.json'),
    path.join(__dirname, 'serviceKey.json')
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        projectId: raw.project_id,
        clientEmail: raw.client_email,
        privateKey: raw.private_key
      };
    }
  }
  throw new Error(
    'Firebase-Credentials fehlen. Setze FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY als Env-Vars, oder lege serviceKey.json im Repo-Root ab.'
  );
}

let initialized = false;
function ensureInit() {
  if (initialized) return;
  if (admin.apps.length === 0) {
    const creds = resolveCredentials();
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      projectId: creds.projectId
    });
  }
  initialized = true;
}

export function getDb() {
  ensureInit();
  return admin.firestore();
}

export const FieldValue = admin.firestore.FieldValue;

export const COLLECTIONS = {
  contacts: 'contacts',
  meetings: 'meetings',
  tasks: 'tasks',
  meta: 'meta'
};

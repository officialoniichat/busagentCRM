const BASE = 'https://api.zoom.us/v2';
const OAUTH = 'https://zoom.us/oauth/token';

let cachedToken = null;
let tokenExpiresAt = 0;

export function hasCredentials() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;

  const auth = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: process.env.ZOOM_ACCOUNT_ID
  });
  const res = await fetch(`${OAUTH}?${params}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` }
  });
  if (!res.ok) {
    throw new Error(`Zoom OAuth ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

async function zoomGet(path, params = {}) {
  const token = await getToken();
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Zoom API ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function zoomJson(method, path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body != null ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    throw new Error(`Zoom API ${method} ${path} ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function createMeeting(payload) {
  return zoomJson('POST', '/users/me/meetings', payload);
}

async function listAllByType(type) {
  const all = [];
  let nextPageToken = '';
  do {
    const data = await zoomGet('/users/me/meetings', {
      type,
      page_size: 300,
      next_page_token: nextPageToken
    });
    all.push(...(data.meetings || []));
    nextPageToken = data.next_page_token || '';
  } while (nextPageToken);
  return all;
}

export async function listMeetings() {
  const [scheduled, upcoming] = await Promise.all([
    listAllByType('scheduled'),
    listAllByType('upcoming')
  ]);
  const byId = new Map();
  for (const m of [...scheduled, ...upcoming]) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()];
}

export async function updateMeeting(id, patch) {
  const token = await getToken();
  const res = await fetch(`${BASE}/meetings/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patch)
  });
  if (res.status === 204 || res.status === 200) return;
  const text = await res.text().catch(() => '');
  const err = new Error(`Zoom PATCH /meetings/${id} ${res.status}: ${text}`);
  err.status = res.status;
  throw err;
}

export async function deleteMeeting(id) {
  const token = await getToken();
  const res = await fetch(`${BASE}/meetings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204 || res.status === 200) return;
  const text = await res.text().catch(() => '');
  const err = new Error(`Zoom DELETE /meetings/${id} ${res.status}: ${text}`);
  err.status = res.status;
  throw err;
}

export async function getMeetingDetail(id) {
  return zoomGet(`/meetings/${id}`);
}

export async function getPastParticipants(uuid) {
  const encoded = encodeURIComponent(encodeURIComponent(uuid));
  try {
    const data = await zoomGet(`/past_meetings/${encoded}/participants`, {
      page_size: 300
    });
    return data.participants || [];
  } catch (err) {
    if (String(err).includes('3001')) return [];
    throw err;
  }
}

export async function getCurrentUser() {
  return zoomGet('/users/me');
}

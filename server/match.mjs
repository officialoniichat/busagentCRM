function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/i)
    .filter((t) => t.length >= 4);
}

function lastName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

/**
 * Score a match between a meeting topic and a CRM contact.
 * Heuristics tuned for patterns like:
 *   "BusAgent - Austausch | KundenLastName | Verkäufer - Firma"
 */
export function scoreMatch(topic, contact) {
  if (!topic || !contact) return 0;
  const t = topic.toLowerCase();
  let score = 0;

  const ln = lastName(contact.name).toLowerCase();
  if (ln.length >= 3) {
    const re = new RegExp(`\\b${escapeRegex(ln)}\\b`, 'i');
    if (re.test(topic)) score += 3;
  }

  const firstParts = (contact.name || '').trim().split(/\s+/);
  if (firstParts.length > 1) {
    const fn = firstParts[0].toLowerCase();
    if (fn.length >= 3) {
      const re = new RegExp(`\\b${escapeRegex(fn)}\\b`, 'i');
      if (re.test(topic)) score += 1;
    }
  }

  for (const w of tokenize(contact.unternehmen)) {
    if (t.includes(w)) score += 2;
  }

  return score;
}

export function matchContactForTopic(topic, contacts) {
  let best = null;
  let bestScore = 0;
  for (const c of contacts) {
    const s = scoreMatch(topic, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= 3 ? { contactId: best.id, score: bestScore } : null;
}

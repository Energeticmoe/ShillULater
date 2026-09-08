import { fetchRedditProfile } from '../_lib/reddit.js';
import { fetchRedditThread, summarizeThread } from '../_lib/reddit-thread.js';
import { callGemini } from '../_lib/gemini.js';
import { buildSystemPrompt, RESPONSE_SCHEMA, FIXED_DISCLAIMERS, AFFILIATION_LABELS } from '../_lib/rubric.js';

const MAX_PASTE_CHARS = 12000;
const MAX_LISTING_ITEMS_IN_PROMPT = 60;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const username = clean(body.username, 100);
  const draft = clean(body.draft, 4000);
  const threadUrl = clean(body.threadUrl, 500);
  const affiliation = Object.prototype.hasOwnProperty.call(AFFILIATION_LABELS, body.affiliation)
    ? body.affiliation
    : 'other';
  const pastedProfileText = clean(body.pastedProfileText, MAX_PASTE_CHARS);
  const pastedThreadText = clean(body.pastedThreadText, MAX_PASTE_CHARS);

  if (!draft) return json({ error: 'Draft comment is required.' }, 400);

  // ---- Profile history ----
  let profileAccess;
  let profileText = '';
  let profileSourceLabel = '';

  if (pastedProfileText) {
    profileAccess = { status: 'user_provided' };
    profileText = pastedProfileText;
    profileSourceLabel = 'User-provided profile text — ownership and completeness unverified.';
  } else if (username) {
    const result = await fetchRedditProfile(env, username);
    profileAccess = { status: result.status, reason: result.reason, coverageNote: result.coverageNote };
    if (result.status === 'ok') {
      profileText = listingToText(result.posts, result.comments);
      profileSourceLabel = `Reddit API. ${result.coverageNote}`;
    }
  } else {
    profileAccess = { status: 'no_username' };
  }

  // ---- Thread context ----
  let threadAccess;
  let threadText = '';
  let threadSourceLabel = '';

  if (pastedThreadText) {
    threadAccess = { status: 'user_provided' };
    threadText = pastedThreadText;
    threadSourceLabel = 'User-provided thread text — unverified.';
  } else if (threadUrl) {
    const result = await fetchRedditThread(env, threadUrl);
    threadAccess = { status: result.status, reason: result.reason };
    if (result.status === 'ok') {
      threadText = summarizeThread(result.raw);
      threadSourceLabel = 'Fetched via Reddit API.';
    }
  } else {
    threadAccess = { status: 'no_url' };
  }

  const userContent = buildUserContent({
    username,
    draft,
    affiliation,
    profileText,
    profileSourceLabel,
    threadText,
    threadSourceLabel,
  });

  let analysis;
  try {
    analysis = await callGemini(env, buildSystemPrompt(), userContent, RESPONSE_SCHEMA);
  } catch (err) {
    return json({ error: `Analysis failed: ${err.message}` }, 502);
  }

  return json({
    analysis,
    access: { profile: profileAccess, thread: threadAccess },
    disclaimers: FIXED_DISCLAIMERS,
  });
}

function clean(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function listingToText(posts, comments) {
  const lines = [];
  for (const p of posts.slice(0, MAX_LISTING_ITEMS_IN_PROMPT)) {
    lines.push(`POST [r/${p.subreddit || '?'}] ${p.title || ''}${p.selftext ? ' — ' + p.selftext.slice(0, 300) : ''}`);
  }
  for (const c of comments.slice(0, MAX_LISTING_ITEMS_IN_PROMPT)) {
    lines.push(`COMMENT [r/${c.subreddit || '?'}] ${(c.body || '').slice(0, 400)}`);
  }
  return lines.join('\n').slice(0, MAX_PASTE_CHARS);
}

function buildUserContent({ username, draft, affiliation, profileText, profileSourceLabel, threadText, threadSourceLabel }) {
  const parts = [];
  parts.push(`REDDIT USERNAME (as entered by the user, not verified): ${username || '(not provided)'}`);
  parts.push(`DECLARED AFFILIATION: ${AFFILIATION_LABELS[affiliation]} (self-reported, not independently verified)`);
  parts.push(`DRAFT COMMENT:\n${draft}`);

  if (threadText) {
    parts.push(`THREAD CONTEXT (source: ${threadSourceLabel}):\n${threadText}`);
  } else {
    parts.push('THREAD CONTEXT: not available for this analysis.');
  }

  if (profileText) {
    parts.push(`PROFILE HISTORY (source: ${profileSourceLabel}):\n${profileText}`);
  } else {
    parts.push('PROFILE HISTORY: not available for this analysis — provide a text-only assessment and say so explicitly in the coverage note.');
  }

  return parts.join('\n\n---\n\n');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

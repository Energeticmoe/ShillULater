// Thread-context fetch. Reddit blocked unauthenticated .json access in May
// 2026, so this will typically fail (status "denied"/"error") unless Reddit
// API credentials are configured (see reddit.js). Failure is expected and
// handled gracefully by the caller — the app falls back to a pasted
// "original post & relevant replies" field.

export async function fetchRedditThread(env, threadUrl) {
  if (!threadUrl) return { status: 'not_provided' };

  let jsonUrl;
  try {
    const u = new URL(threadUrl);
    if (!/reddit\.com$/.test(u.hostname.replace(/^www\./, '').replace(/^old\./, ''))) {
      return { status: 'error', reason: 'not_a_reddit_url' };
    }
    jsonUrl = `${u.origin}${u.pathname.replace(/\/$/, '')}.json`;
  } catch {
    return { status: 'error', reason: 'invalid_url' };
  }

  try {
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': env.REDDIT_USER_AGENT || 'shill-ulate-internal-tool/1.0 (by Maven)' },
    });
    if (res.status === 403) return { status: 'denied', reason: 'http_403' };
    if (!res.ok) return { status: 'error', reason: `http_${res.status}` };
    const data = await res.json();
    return { status: 'ok', raw: data };
  } catch (err) {
    return { status: 'error', reason: err.message };
  }
}

// Reduces a Reddit thread JSON payload down to title + selftext + a bounded
// number of top-level comment bodies, so we don't blow the LLM context window
// on a huge thread.
export function summarizeThread(raw, maxComments = 25, maxChars = 6000) {
  try {
    const postData = raw?.[0]?.data?.children?.[0]?.data;
    const comments = raw?.[1]?.data?.children || [];
    const lines = [];
    if (postData) {
      lines.push(`TITLE: ${postData.title || ''}`);
      if (postData.selftext) lines.push(`POST BODY: ${postData.selftext}`);
    }
    let count = 0;
    for (const c of comments) {
      if (count >= maxComments) break;
      const body = c?.data?.body;
      if (body && body !== '[deleted]' && body !== '[removed]') {
        lines.push(`COMMENT: ${body}`);
        count += 1;
      }
    }
    return lines.join('\n\n').slice(0, maxChars);
  } catch {
    return '';
  }
}

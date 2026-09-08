// Reddit account-history fetch. INERT BY DEFAULT: without approved Reddit API
// credentials (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USER_AGENT set
// as environment variables), this always reports status "unavailable" and the
// app falls through to the user-paste flow. See /shill-ulate/README.md for why.

const LISTING_CAP = 300; // total items per listing type (posts / comments)
const MAX_PAGES = 3; // 100 items per page

async function getAppOnlyToken(env) {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USER_AGENT) {
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return { ok: false, reason: `token_http_${res.status}` };
    const data = await res.json();
    if (!data.access_token) return { ok: false, reason: 'token_missing' };
    return { ok: true, token: data.access_token };
  } catch (err) {
    return { ok: false, reason: `token_error:${err.message}` };
  }
}

async function fetchListing(env, token, username, kind) {
  const items = [];
  let after = null;
  let pages = 0;
  let capped = false;
  let status = 'ok';

  while (pages < MAX_PAGES) {
    const url = new URL(`https://oauth.reddit.com/user/${encodeURIComponent(username)}/${kind}`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sort', 'new');
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': env.REDDIT_USER_AGENT },
    });

    if (res.status === 403) return { status: 'denied', items, reason: 'http_403' };
    if (res.status === 404) return { status: 'not_found', items, reason: 'http_404' };
    if (res.status === 429) return { status: 'rate_limited', items, reason: 'http_429' };
    if (!res.ok) return { status: 'error', items, reason: `http_${res.status}` };

    const data = await res.json();
    const children = data?.data?.children || [];
    for (const c of children) items.push(c.data);
    after = data?.data?.after || null;
    pages += 1;

    if (!after) break;
    if (items.length >= LISTING_CAP) { capped = true; break; }
  }

  return { status, items: items.slice(0, LISTING_CAP), capped, hasMore: !!after };
}

export async function fetchRedditProfile(env, username) {
  const tokenResult = await getAppOnlyToken(env);
  if (!tokenResult.ok) {
    return {
      status: 'unavailable',
      reason:
        tokenResult.reason === 'not_configured'
          ? 'Reddit API credentials are not configured for this deployment (pending Reddit developer approval under the Responsible Builder Policy).'
          : `Could not authenticate with the Reddit API (${tokenResult.reason}).`,
      posts: [],
      comments: [],
      coverageNote: 'No account history was reviewed.',
    };
  }

  const [posts, comments] = await Promise.all([
    fetchListing(env, tokenResult.token, username, 'submitted'),
    fetchListing(env, tokenResult.token, username, 'comments'),
  ]);

  if (posts.status !== 'ok' && comments.status !== 'ok') {
    const failed = posts.status === 'denied' || comments.status === 'denied' ? 'denied' : 'error';
    return {
      status: failed,
      reason: `Reddit API returned an error fetching u/${username} (posts: ${posts.status}, comments: ${comments.status}). The account may be private, suspended, or nonexistent, or the request was blocked.`,
      posts: [],
      comments: [],
      coverageNote: 'No account history was reviewed.',
    };
  }

  const postCount = posts.status === 'ok' ? posts.items.length : 0;
  const commentCount = comments.status === 'ok' ? comments.items.length : 0;
  const coverageNote =
    `Reviewed ${postCount} most recent post(s) and ${commentCount} most recent comment(s) available via the Reddit API's public listing endpoints. ` +
    `This endpoint exposes only a limited window of recent activity — older history is not accessible this way. This is not the full account history.` +
    (posts.capped || comments.capped ? ' Results were additionally capped by this tool for performance.' : '');

  return {
    status: 'ok',
    posts: posts.status === 'ok' ? posts.items : [],
    comments: comments.status === 'ok' ? comments.items : [],
    coverageNote,
  };
}

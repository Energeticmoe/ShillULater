# Shill-ulate

A rubric-based promotional-tone risk checker for Reddit comment drafts, built for Maven employees to self-review
before posting. Scores a draft 0-100 on "Promotional-tone risk," explains why with quoted excerpts, and produces
an improved rewrite.

**This is a rubric-scored assistant, not a lie detector.** It cannot establish that someone is or isn't a paid
shill, cannot detect coordinated astroturfing from text alone, and a 0 score never guarantees authenticity or
that a post will be well received. Those constraints are enforced in the prompt (`functions/_lib/rubric.js`) and
repeated in the UI on every result.

## How it works

```
Browser (public/) --POST /api/evaluate--> Cloudflare Pages Function (functions/api/evaluate.js)
                                                |
                                                |-- tries Reddit API for profile history (functions/_lib/reddit.js)
                                                |-- tries Reddit API for thread context (functions/_lib/reddit-thread.js)
                                                |-- falls back to user-pasted text for either, if fetch fails
                                                |
                                                v
                                        Gemini API (functions/_lib/gemini.js)
                                        rubric prompt + JSON schema -> structured result
```

No database, no auth, no bulk data collection. The Gemini API key stays server-side (Cloudflare Pages Function
environment variable) and is never sent to the browser.

## Reddit access: feasibility finding (checked before building the integration)

As of when this was built, self-service Reddit API registration is closed. Reddit's **Responsible Builder
Policy** (Nov 2025) requires a manual approval form with a written business justification for every new API
credential; approval typically takes 2-4 weeks, and small/internal-tool requests are the most frequently
rejected category. The older workaround of appending `.json` to a public Reddit URL without authentication was
blocked in May 2026 (now returns 403). Even with approved credentials, Reddit's listing endpoints only expose a
recent-activity window (roughly the last ~1000 items) — never a full account history.

**Practical effect:** `functions/_lib/reddit.js` and `functions/_lib/reddit-thread.js` are fully implemented and
will activate automatically the moment `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USER_AGENT` are set
as environment variables with approved credentials. Until then, they correctly report `status: "unavailable"`,
and the app falls through to the paste-based flow, which is the real, working path today:

- User pastes their own Posts/Comments tab content when asked (with an explicit "ownership and completeness
  unverified" label — pasting text proves nothing about who copied it).
- User pastes the original post/relevant replies if the thread URL can't be fetched.
- The app always tells the user what was and wasn't reviewed; it never claims to have seen "the whole account."

If Maven wants to pursue approved Reddit API access, that means submitting Reddit's manual approval form
yourself with a specific, named business justification — I can't submit that application on your behalf, and
approval is not guaranteed even with a good case.

## Setup

1. **Get a Gemini API key** from [Google AI Studio](https://aistudio.google.com/). This is the only required
   credential.
2. Deploy to **Cloudflare Pages** (free tier is generous — 100k requests/day):
   - Connect this repo, build output directory: `public`, build command: none (static + Functions).
   - In the Pages project's **Settings → Environment variables**, add `GEMINI_API_KEY` (see `.env.example` for
     the full list, including the optional future Reddit variables).
3. Push to the connected branch — Cloudflare Pages auto-deploys.

Local dev: `npm install` then `npm run dev` (requires `wrangler`; needs a local `.env`/`wrangler` secret setup for
`GEMINI_API_KEY` — see [Cloudflare's docs](https://developers.cloudflare.com/pages/functions/bindings/) for local
env var binding).

## Credentials / access this project needs

| What | Required for v1? | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | From Google AI Studio. Server-side only. |
| Cloudflare account (free tier) | Yes | Hosting. |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USER_AGENT` | No — future only | Only if Maven pursues and receives Reddit API approval. App works fully without these via the paste fallback. |

## Evaluation

See [`eval/README.md`](eval/README.md) for the hand-labeled evaluation set: ground rules, schema, and why it's
evaluation-only (never training) — driven by Reddit's Data API Terms, which prohibit training ML/AI models on
Reddit content without a separate license.

## What would justify going beyond "LLM + rubric"

- A signed Reddit data-licensing agreement, or an approved, appropriately-scoped research arrangement — neither
  of which we currently have.
- Evidence, from the eval set above, that the rubric-prompted LLM plateaus below an acceptable false-positive
  rate despite prompt iteration.
- Budget for ongoing human relabeling/QA — a fine-tuned model still needs the same skepticism about accusation
  labels applied to whatever it's trained on.

None of that is a v1 problem; this ships as LLM + explicit rubric only.

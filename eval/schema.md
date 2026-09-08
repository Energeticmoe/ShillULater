# Evaluation example schema

Each file in `examples/` is one JSON object with these fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | `yyyy-mm-dd-shortslug`, matches the filename without `.json` |
| `category` | string | One of: `genuine_recommendation`, `disclosed_company_reply`, `promotional_comment`, `disputed_accusation` |
| `comment_text` | string | The exact comment being evaluated |
| `thread_context_summary` | string | 1-3 sentences: what the thread/post was asking, enough to judge relevance |
| `declared_or_apparent_affiliation` | string | What the commenter said about themself, if anything, or "none stated" |
| `accusation_present` | boolean | Did a reply call this comment shill/fake/paid/astroturfing? |
| `accusation_text` | string \| null | The accusing reply's own wording, quoted — only if `accusation_present` is true |
| `human_verdict` | string | Reviewer's independent judgment: `low_risk`, `medium_risk`, `high_risk` |
| `human_verdict_rationale` | string | Why — specific, tied to the rubric factors, not a restatement of the accusation |
| `date_reviewed` | string | ISO date |
| `reviewer` | string | Reviewer's initials or email |
| `notes` | string | Anything unusual — sarcasm, brigading context, ambiguity, etc. |
| `retention_note` | string | Default: `"Public comment text only; no additional profile data collected; retained for evaluation use only per Reddit Data API Terms."` |

Do not add fields that require additional Reddit access beyond the single thread being reviewed (e.g. don't go
pull the commenter's post history to "enrich" an example — that would violate the evaluation-only, single-read
ground rule in [README.md](README.md)).

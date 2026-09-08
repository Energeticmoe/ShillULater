# Shill-ulate — evaluation set

This folder is for **evaluating** the rubric/LLM's judgment, not for training anything. Nothing here should
ever be used as a training corpus.

## Why evaluation-only

Reddit's Data API Terms grant no right to use Reddit content to train a machine-learning or AI model without a
separate licensing agreement, and Reddit's Responsible Builder Policy (Nov 2025) plus the Reddit for Researchers
program both carry the same restriction even for approved/academic access. We have neither a commercial license
nor a research agreement, so this project does not, and should not, build a training set. See the top-level
[README.md](../README.md) for the full feasibility writeup.

What we *can* do, within a normal person's authenticated, rate-limited use of Reddit: read individual public
threads a reviewer is actually looking at, and hand-label a small number of examples to check whether
Shill-ulate's rubric output matches human judgment. That's what this folder holds.

## Ground rules

1. **One example, one human reviewer, one read.** No bulk export, no scraping, no automated collection. Every
   entry in `examples/` was read and labeled by a person.
2. **Accusations are not labels.** A reply calling a comment "shill," "fake," "paid," or "astroturf" only ever
   goes in the `accusation_present` / `accusation_text` fields. The `human_verdict` field is the reviewer's own
   independent judgment after reading the comment and its context — never a copy of the accusation.
3. **Cover all four categories**, not just the interesting/disputed ones:
   - `genuine_recommendation` — enthusiastic, unaffiliated, no promo risk
   - `disclosed_company_reply` — affiliated and says so
   - `promotional_comment` — reads as promotional, whether or not affiliation is disclosed
   - `disputed_accusation` — a comment that drew a shill/fake/paid/astroturfing accusation in the replies,
     regardless of whether the reviewer agrees with the accusation
4. **Data minimization.** Store only the comment text, thread context needed to understand it, and the review
   notes below. No usernames beyond what's already public in the quoted text, no additional profile scraping to
   "build out" an example. Delete an example if it's no longer needed for evaluation, per the Data API Terms'
   deletion requirement.
5. **Separate eval examples from prompt-development examples.** If you used a specific thread while iterating the
   rubric prompt in `functions/_lib/rubric.js`, don't also add it to `examples/` — pick fresh ones for evaluation
   so the numbers mean something.

## Fields

See [schema.md](schema.md) for the full field list. [template.json](template.json) is a ready-to-copy blank entry.

## Running an evaluation pass

There's no scoring script yet — with a target of 100-300 hand-labeled examples (see the top-level README), start
manual: run each `examples/*.json` comment through the live Shill-ulate app, and record whether the app's score
band and `human_verdict` agree. Track, at minimum:

- **False positive rate**: genuine_recommendation / disclosed_company_reply examples that scored high risk.
- **False negative rate**: promotional_comment examples that scored low risk.
- **Accusation agreement rate**: for disputed_accusation examples, how often the app's independent read agrees
  with the accusation vs. sides with the original commenter vs. is genuinely ambiguous — this number tells you
  how much weight (if any) accusations should ever carry, which per the project's own ground rules should stay
  low.

Once there are enough examples to make percentages meaningful, a small script to tabulate these can live here —
don't build it prematurely on top of 10 examples.

## Third-party datasets considered and declined (2026-09)

Two datasets were suggested as possible sources. Neither is used. Recorded here so the reasoning isn't lost:

- **`MentionBroker/reddit-comment-generation-v1`** (Hugging Face). Verified to exist. Its own description says it's
  built by MentionBroker — a commercial "Reddit brand visibility / Reddit mentions" service — as SFT training data
  for an LLM to generate "high-authority, authentic community responses," i.e. it's a corpus of comments purpose-built
  to insert brand mentions while reading as genuine. That's the input side of astroturfing, not the detection side.
  Training or evaluating on it teaches a model that specific vendor's synthetic style, not real-world promotional
  language, and studying/redistributing a commercial astroturfing vendor's generation corpus is not something this
  project should do even framed as "detector training data." **Declined — do not use.**
- **`SocialGrep/the-reddit-dataset-dataset`** (Hugging Face). Verified to exist, labeled CC-BY-4.0 by the publisher.
  More legitimate on its face than the above, but the CC-BY-4.0 label is SocialGrep's own relicensing claim over
  content whose underlying copyright sits with individual redditors — it doesn't resolve the same restriction this
  project is already built around (Reddit's Data API Terms bar using Reddit-sourced content to train ML/AI models
  without Reddit's own license, regardless of the path the data took to reach you). Using it for training would need
  a legal review of that gap first, and per the project's own ground rules above, wouldn't replace hand-reviewed
  evaluation examples anyway (bulk import contradicts the "one human reviewer, one read" rule). **Not used for v1;
  revisit only alongside a legal review if/when training is ever actually pursued.**

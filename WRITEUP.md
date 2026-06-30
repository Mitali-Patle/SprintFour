# SprintFour PII Triage — Writeup

## The problem as I read it
The prompt looks like it's about redacting documents, but Maya's real constraint is different: she has ~200 case files and not enough time. The bottleneck was never the redacting — it's the *reviewing*. A tool that auto-redacts every file instantly but still makes her eyeball all of them hasn't saved her anything; it's just moved the work. So I optimized for one thing: route Maya's limited attention to the documents that actually need a human, and let her clear the rest without opening them.

## What I built
A triage-first review tool. Documents arrive pre-classified by risk and sorted so the riskiest surface first; the large low-risk majority (106 of 155 documents) can be cleared in bulk through a dedicated panel rather than reviewed one by one. For the minority that need attention, a two-panel review screen shows the document alongside a list of AI suggestions she can accept or reject, with the reasoning shown *before* she acts, not after. Because case files share entities, one decision on a recurring entity (a client, a person, a company) propagates across all of that entity's documents — with a preview of the blast radius ("will update N spans across M documents") before she commits — so she never re-decides the same call across dozens of files. Every action is recorded to an audit log, and clearing a document is an explicit "Finalize" step, never automatic — the human stays the final authority.

## A modeling decision I'm deliberate about
I kept two distinct axes rather than collapsing them into one: a detection risk tier (red/yellow/green — how dangerous a document is) and a review workflow status (Needs Review → In Progress → Cleared — how far Maya has gotten). Conflating "risky" with "unreviewed" would have thrown away the prioritization signal that powers triage, so the two facts live in separate fields and the dashboard shows both.

## The part I'm proudest of
A detector can only report what it *finds*, never what it *misses* — so a real phone number left in plain text, the most dangerous error, is invisible to any tool that only shows the detector's own output. I added an independent recall pass that scans the visible text for PII the detector missed and surfaces it prominently in review. At high document volume this matters most, because a confidently-wrong miss would otherwise sail past a human who has no time to read every file in full.

## What I deliberately did not build
Real PDF upload and a real database — I seed from generated JSON, because file plumbing wasn't where the judgment lived. A "browse all documents" view — it duplicates the dashboard and quietly contradicts the thesis, since the whole point is that Maya *doesn't* open everything. Search, filters, and a confidence heatmap — discoverability features that don't serve a user whose problem is having too much to look at, not too little. A "learning mode" that adapts to her rejections — appealing, but doing it honestly is real work and doing it shallowly is a fake button a judge would see through in seconds; propagation delivers most of that value deterministically. And no real-time LLM detection — the handout said detection is a means to an end, so I precompute it once at ingestion and keep it out of the hot path, so nothing makes Maya wait.

## The tradeoff I made on purpose
Speed versus safety. Every document cleared without her eyes on it saves time *and* risks letting a miss slip through. I resolved it by putting the one piece of friction — an explicit finalize, a propagation preview — exactly at the high-risk actions and nowhere else, and by making the recall pass surface missed PII so the documents most likely to hide a real leak are the ones flagged for her attention.

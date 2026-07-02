# PRD — NNE Assessment Lab (SQL / Python / DAX Tester)

## Original Problem Statement
"I need Web based SQL query, Python and DAX tester to test the answer of attached questions." — attached: NNE India Two-Role Data Analyst First-Round Assessment (Set A Advanced, Set B Senior, 20 questions each, 30 min, 100 marks).

## User Choices
- Evaluation: execute SQL/Python where possible + AI grading for everything (Claude Sonnet 4.6 via Emergent LLM key)
- Users: candidates take the timed test directly in the browser
- Both Set A and Set B included
- Results saved with candidate history + CSV export

## Architecture
- FastAPI + MongoDB backend (`/app/backend/server.py`, question bank + rubrics in `questions.py`)
- SQL runner: in-memory SQLite seeded with EngineeringTag, PI_TAGS, ObjectRevision, ProjectObject, TagQuality, TagData
- Python runner: subprocess sandbox (15s timeout, blocked-module regex) with `tags.csv` sample data + pandas
- AI grading: emergentintegrations LlmChat, claude-sonnet-4-6, 4 concurrent batches of 5 questions, JSON scores 0-5 + feedback
- React frontend (Swiss high-contrast design, JetBrains Mono editor): Landing → Test (timer, navigator, run code) → Results → History

## Implemented (2026-06)
- Candidate registration + set selection (A: cut-off 65/strong 75; B: 75/85)
- 30-min timed test, auto-submit, localStorage answer persistence, question navigator
- Live SQL and Python execution with output panel; DAX/text AI-graded only
- Submit → AI grading → per-question scores/feedback, total /100, verdict (FAIL / PASS / STRONG SHORTLIST)
- Results history table + client-side CSV export
- Admin JWT login (bcrypt + PyJWT, admin seeded from .env) protecting /history page and GET /api/results; logo icon removed from header (2026-07)
- Admin history cleanup: per-row delete + Clear All (cascades to sessions), confirm dialogs (2026-07)
- Tested: iteration_1 — 100% backend (18/18), 100% frontend flows

## Backlog
- P1: Regrade button for questions where grading failed
- P2: Question-level flagging for review; tab-switch/anti-cheat detection; email results to interviewer
- P2: Harden Python sandbox (open/getattr bypass possible — acceptable for internal tool)

## Test Credentials
None — app has no auth.

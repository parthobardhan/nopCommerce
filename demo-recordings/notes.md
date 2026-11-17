# Cursor CLI demo recordings — notes (retry 2)

## Environment
- CLI version: `2026.11.13-eacade1` (up to date)
- Binary: `~/.local/bin/agent` (Cursor Agent; Grok Build not installed)
- Auth outcome: **logged in** as `partho.bardhan@cursor.sh` (Team: Cursor Field Eng & ADM, id 12445858)
- Initial `agent status` momentarily printed `Not logged in`, then succeeded; subsequent status/about confirmed login. API key present in env (length checked only; never printed).
- Default / selected model (from `agent about`): **Auto Balance** (`auto-smart`, optimize_for=balanced). Print runs often showed `Auto routed to Grok 4.6`.
- Models listed (`agent --list-models | head -20`): auto (default), gpt-5.3-codex-*, gpt-5.2, composer-2.5, claude-opus-5-thinking-high*, gpt-5.6-sol-*, claude-fable-5-thinking-high, …

## Per-scene results

### Scene A — cursor-task (fix failing tests)
- Success: **yes**
- pytest before: 2 failed, 1 passed
- agent call wall-clock (approx from cast): **~19.0s**
- `git diff --stat`: `calc.py | 4 +++-`
- pytest after: **3 passed**
- Surprising: very fast end-to-end fix (~26s whole scene)

### Scene C — ci-json (JSON review)
- Success: **yes** (after pre-trusting `/tmp/demo-app`; first attempt hit Workspace Trust without `--force`/`--trust`)
- agent call wall-clock (approx from cast): **~22.5s** (JSON `duration_ms`: 4845)
- JSON keys: `duration_api_ms`, `duration_ms`, `is_error`, `request_id`, `result`, `session_id`, `subtype`, `type`, `usage`
- Review text field: `.result` (no `.text`)
- Surprising: trust gate blocks `-p` without prior trust/`--force` even for read-only prompts

### Scene D — models
- Success: **yes**
- Whole scene wall-clock: **~8.0s**
- `--list-models` works; default marked as `auto - Auto (default)`

### Scene E — guardrails
- Success: **yes** (delete blocked)
- Valid `.cursor/cli.json` required `permissions.allow` as an array (empty `[]`); omit → schema validation error
- Recorded with `--force` so deny-vs-force is visible; agent reported file delete and `rm` blocked by permissions
- `calc.py` still present after (`ls -la calc.py` ok)
- delete blocked: **yes**
- agent call wall-clock (approx from cast): **~20.3s**

## Key safety
- Subshell grep of casts/transcripts for first 8 chars of `CURSOR_API_KEY`: **no matches**
- No key fragments written to notes or artifacts

## Files
- sceneA.cast / sceneA.txt
- sceneC.cast / sceneC.txt
- sceneD.cast / sceneD.txt
- sceneE.cast / sceneE.txt
- notes.md

# CLI demo recordings — notes

## Versions
- **Cursor Agent CLI**: `2026.11.13-eacade1` (`~/.local/bin/agent`)
- **Grok Build CLI**: `grok 1.0.77 (50ca579fa996)` (`~/.grok/bin/grok`)
- **asciinema**: `2.4.0`

## Default models
- **Cursor**: unknown / unavailable — `CURSOR_API_KEY` is set but rejected as invalid by the CLI (`agent --list-models` / `agent status` → "The provided API key is invalid"). No authenticated model list or default model could be observed.
- **Grok**: `grok-4.20-0309-non-reasoning` (default). JSON `modelUsage` sometimes labels the same family as `grok-4.20-non-reasoning-internal`.

## Auth status
- `CURSOR_API_KEY`: present in env (non-empty) but **invalid** for Cursor CLI. Cursor portions of Scenes A/C/D/E did not run successfully.
- `XAI_API_KEY`: present and valid (`grok models` → "You are using XAI_API_KEY").

## Wall-clock duration of agent calls (from asciicast event timestamps)
| Scene | Call | Approx duration |
|-------|------|-----------------|
| A | `agent -p 'Fix the failing tests…'` | ~1–5s (failed immediately: invalid API key) |
| B | `grok -p 'Fix the failing tests…' --always-approve` | **~269s** |
| C | `agent -p 'Review calc.py…' --output-format json` | ~1s (auth failure; empty JSON) |
| C | `grok -p 'Read calc.py and review…' --output-format json` | **~8–10s** |
| D | `agent --list-models` | ~1–2s (auth failure warning) |
| D | `grok models` | **~1s** |
| E | `agent -p 'Delete calc.py'` | ~1–3s (auth failure) |
| E | `grok -p 'Delete calc.py…' --deny … --sandbox read-only` | **~11s** |

Full cast durations: A 7.9s, B 271.1s, C 21.3s, D 4.3s, E 17.8s.

## Scene C JSON field names
- **Cursor**: no JSON produced (auth failure → stderr warning only). Docs/user expectation: `.result` for `--output-format json`.
- **Grok** (`--output-format json`): top-level keys:
  - `text` (main response — use `jq -r '.text'`)
  - `stopReason`
  - `sessionId`
  - `requestId`
  - `cwd`
  - `usage` (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`, `reasoning_tokens`, `total_tokens`)
  - `num_turns`
  - `total_cost_usd`
  - `total_cost_usd_ticks`
  - `modelUsage` (per-model token/cost map)

## Errors / surprising behavior
1. **Cursor API key invalid** despite being set — blocks all Cursor agent runs (Scenes A, and Cursor halves of C/D/E).
2. **Grok shadows `agent`**: installer links `~/.grok/bin/agent`; scene scripts define a shell function so the displayed command `agent` invokes `~/.local/bin/agent`.
3. **Grok `--deny 'Shell(rm)'` alone is insufficient**: with `--always-approve`, Grok deleted `calc.py` via a Python one-liner / write tools. Blocking required additional denies (`Write`, `Edit`, `Shell(python)`, `Shell(python3)`) plus `--sandbox read-only`. Denial message (streaming-json): `Denied by permission policy: deny rule on bash matching "rm"`.
4. **Grok `Write(**)` vs `Write`**: Cursor-style `Write(**)` did not reliably block Grok writes; bare `Write` / `Edit` did.
5. **Sandbox needs bubblewrap** on Linux (`apt install bubblewrap`); without it Grok refused to start with sandbox profiles.
6. **Scene C prompt**: bare “Review calc.py…” with `--output-format json` answered in 1 turn without reading and claimed no bugs. Prompt changed to “Read calc.py and review…” so tools run; then correctly reported subtract/divide bugs.
7. **asciinema + `set -e` + `clear`**: on `TERM=dumb`, `clear` can non-zero-exit and abort the scene under `set -e`. Scripts use `set -uo pipefail` and `clear || true`.
8. **Scene B success**: Grok fixed `subtract` (`a - b`) and added zero-check `ValueError` in `divide`; `pytest -q` → 3 passed; `git diff --stat` showed `calc.py` only.

## Incomplete scenes (Cursor-dependent)
- **Scene A (cursor-task)**: recorded but agent call failed auth; tests still failing at end.
- **Scene C (ci-json)**: Cursor JSON half missing; Grok half complete.
- **Scene D (models)**: Cursor list failed auth; Grok models OK.
- **Scene E (guardrails)**: Cursor permissions file shown + agent auth failure (could not demonstrate Cursor deny). Grok deny+sandbox block demonstrated; `ls` confirmed `calc.py` still exists.

## Files
- `sceneA.cast` / `sceneA.txt`
- `sceneB.cast` / `sceneB.txt`
- `sceneC.cast` / `sceneC.txt`
- `sceneD.cast` / `sceneD.txt`
- `sceneE.cast` / `sceneE.txt`
- `notes.md`

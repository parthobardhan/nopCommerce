# Cursor CLI demo recordings — notes

## Cursor CLI version
2026.11.13-eacade1

## Auth outcome
**FAILED — remaining scenes aborted.**

`agent status` output:
```
Not logged in
```

`agent --list-models` output (exact error text):
```
⚠ Warning: The provided API key is invalid.
The API key was loaded from the CURSOR_API_KEY environment variable.
Please check you have the right key, create a new one, or authenticate without it.
```

CURSOR_API_KEY was present in the environment (boolean true, non-zero length) but the CLI rejected it. No key material is recorded here.

## Default / listed models
Not available — auth failed before models could be listed.

## Scene results
| Scene | Status | Notes |
|-------|--------|-------|
| A (cursor-task) | aborted | Not recorded — auth invalid |
| C (ci-json) | aborted | Not recorded — auth invalid |
| D (models) | aborted | Not recorded — auth invalid |
| E (guardrails) | aborted | Not recorded — auth invalid |

## Wall-clock of agent calls
N/A — no agent prompt calls were made after auth failure.

## Scene C JSON field names
N/A

## Scene A tests
Demo app was prepared and local `pytest -q` showed 2 failed, 1 passed before abort. Agent fix was not attempted.

## Scene E delete blocked
N/A — not attempted.

## Safety
No API key fragments written to notes, casts, or transcripts.

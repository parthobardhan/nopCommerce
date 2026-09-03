# pstack (project install)

Vendored from [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) so Cloud Agents can use it without a Marketplace install.

- Version: 0.14.8
- Upstream commit: 7314f723a487ec406b6369fe5865ba034cfed166
- License: MIT (see `plugins/pstack/LICENSE`)

`/add-plugin pstack` is a Cursor client command. This repo copies the plugin into:

- `.cursor/plugins/pstack` — full plugin (manifest, skills, agents, docs)
- `.cursor/skills` and `.cursor/agents` — same skills/agents on the paths Cloud Agents load

Next: in a new chat, run `/setup-pstack` to write per-role model overrides, then `/poteto-mode`.

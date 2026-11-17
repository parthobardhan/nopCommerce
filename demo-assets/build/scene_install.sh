#!/usr/bin/env bash
export HOME=/tmp/freshhome
rm -rf "$HOME" && mkdir -p "$HOME" && cd "$HOME"
export PATH="$HOME/.grok/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
export PS1='$ '

type_run() {
  printf '\033[1;32m$ \033[0m'
  local s="$1"
  for ((i = 0; i < ${#s}; i++)); do printf '%s' "${s:i:1}"; sleep 0.035; done
  sleep 0.6
  printf '\n'
  eval "$1"
  sleep 1.2
}

clear
type_run "curl https://cursor.com/install -fsS | bash 2>&1 | tail -4"
type_run "curl -fsSL https://x.ai/cli/install.sh | bash 2>&1 | tail -4"
type_run "agent --version; grok --version"
type_run "which -a agent"
printf '\033[1;33m# Grok Build also installs an "agent" command, and it is first on PATH\033[0m\n'
sleep 1.5
type_run "~/.local/bin/agent --version   # the real Cursor CLI"
sleep 2

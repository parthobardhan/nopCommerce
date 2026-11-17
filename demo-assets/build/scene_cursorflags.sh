#!/usr/bin/env bash
cd /tmp/demo
agent() { ~/.local/bin/agent "$@"; }
type_run() {
  printf '\033[32m$ \033[0m'
  local s="$1"
  for ((i = 0; i < ${#s}; i++)); do printf '%s' "${s:i:1}"; sleep 0.03; done
  sleep 0.6
  printf '\r\n'
  eval "$1"
  sleep 1.2
}
clear
type_run "agent --version"
type_run "agent --help | grep -E -- '--print|--output-format|--mode |--model|--force|--worktree' | cut -c1-100"
sleep 1.5

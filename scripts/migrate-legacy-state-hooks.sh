#!/usr/bin/env bash
# CCC2: migrate legacy "echo <state> > ~/.ccc/states/$CCC_SESSION_NAME" hooks
# (used by older Claude Code / Codex / Gemini configs) to the unix socket
# protocol consumed by CCC's StateDetector.
#
# Defaults to ~/.claude/settings.json — pass a different file as the first
# positional argument to migrate Codex / Gemini / other tool configs.
#
# Usage:
#   bash scripts/migrate-legacy-state-hooks.sh                    # rewrite ~/.claude/settings.json
#   bash scripts/migrate-legacy-state-hooks.sh /path/to/conf.json # rewrite a specific config
#   bash scripts/migrate-legacy-state-hooks.sh --dry-run          # preview without writing
#   bash scripts/migrate-legacy-state-hooks.sh /path/conf --dry-run
#
# Hook command shape:
#   OLD: echo <state> > $HOME/.ccc/states/$CCC_SESSION_NAME
#   NEW: printf 'agent-<state>:%s\n' "$CCC_SESSION_NAME" | nc -U $HOME/.ccc/events.sock -w1

set -euo pipefail

SOCK="${HOME}/.ccc/events.sock"
SETTINGS="${HOME}/.claude/settings.json"
DRY_RUN=0

for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "unknown flag: ${arg}" >&2; exit 2 ;;
    *) SETTINGS="${arg}" ;;
  esac
done

if [[ ! -f "${SETTINGS}" ]]; then
  echo "No ${SETTINGS} found — nothing to migrate." >&2
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "This migration requires jq (sudo apt install jq / brew install jq)." >&2
  exit 1
fi

TRANSFORM='
  walk(
    if type == "object" and has("command") and (.command | test("\\.ccc/states/\\$CCC_SESSION_NAME"))
    then
      .command |= (
        capture("echo[[:space:]]+(?<state>idle|working|waiting)") as $m
        | "printf '\''agent-\($m.state):%s\\n'\'' \"$CCC_SESSION_NAME\" | nc -U " + $sock + " -w1"
      )
    else .
    end
  )
'

NEW_JSON="$(jq --arg sock "${SOCK}" "${TRANSFORM}" "${SETTINGS}")"

if [[ "${NEW_JSON}" == "$(cat "${SETTINGS}")" ]]; then
  echo "No matching hook commands in ${SETTINGS} — nothing to do."
  exit 0
fi

if [[ "${DRY_RUN}" == 1 ]]; then
  echo "--- would write to ${SETTINGS}:"
  echo "${NEW_JSON}"
  exit 0
fi

cp "${SETTINGS}" "${SETTINGS}.bak"
printf '%s\n' "${NEW_JSON}" > "${SETTINGS}"
echo "Migrated ${SETTINGS} (backup at ${SETTINGS}.bak)."
echo "Hooks now write to ${SOCK} via nc -U."

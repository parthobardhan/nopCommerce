#!/usr/bin/env python3
"""Deny force-push and destructive database / App_Data commands."""

import json
import re
import sys

DENIED = (
    (re.compile(r"git\s+push\s+.*(--force|--force-with-lease|-f)\b", re.I), "force-push"),
    (re.compile(r"\b(drop\s+(database|table)|truncate\s+table)\b", re.I), "destructive SQL"),
    (re.compile(r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r).*(App_Data|\.git)\b", re.I), "destructive delete"),
)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("{}")
        return

    command = ""
    if isinstance(payload, dict):
        command = str(payload.get("command") or "")

    for pattern, label in DENIED:
        if pattern.search(command):
            print(
                json.dumps(
                    {
                        "permission": "deny",
                        "user_message": f"Hook blocked a {label} command.",
                        "agent_message": (
                            f"Refusing this shell command ({label}). "
                            "Use a plugin or a normal commit; do not destroy App_Data or rewrite remote history."
                        ),
                    }
                )
            )
            return

    print(json.dumps({"permission": "allow"}))


if __name__ == "__main__":
    main()

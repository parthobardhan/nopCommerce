#!/usr/bin/env python3
"""Deny agent edits to core checkout/order code. Prefer a widget plugin."""

import json
import sys

BLOCKED_FRAGMENTS = (
    "CheckoutController.cs",
    "Nop.Services/Orders/",
    "Nop.Services\\Orders\\",
)


def extract_paths(payload: dict) -> list[str]:
    paths: list[str] = []
    for key in ("tool_input", "arguments", "input", "params"):
        value = payload.get(key)
        if isinstance(value, dict):
            for path_key in ("path", "file_path", "filePath", "target_file"):
                candidate = value.get(path_key)
                if isinstance(candidate, str):
                    paths.append(candidate)
            old_string = value.get("old_string")
            new_string = value.get("new_string")
            if isinstance(old_string, str) and isinstance(new_string, str):
                # StrReplace still has a path on the same object.
                pass
    for key in ("path", "file_path", "filePath"):
        candidate = payload.get(key)
        if isinstance(candidate, str):
            paths.append(candidate)
    return paths


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("{}")
        return

    if not isinstance(payload, dict):
        print("{}")
        return

    for path in extract_paths(payload):
        if any(fragment in path for fragment in BLOCKED_FRAGMENTS):
            print(
                json.dumps(
                    {
                        "permission": "deny",
                        "user_message": (
                            "Hook blocked a core checkout/order edit. "
                            "Use an IWidgetPlugin on CheckoutCompletedTop instead."
                        ),
                        "agent_message": (
                            "Do not edit CheckoutController or Nop.Services/Orders. "
                            "Scaffold src/Plugins/Nop.Plugin.Widgets.* and attach it to "
                            "PublicWidgetZones.CheckoutCompletedTop. Follow the add-widget-plugin skill."
                        ),
                    }
                )
            )
            return

    print(json.dumps({"permission": "allow"}))


if __name__ == "__main__":
    main()

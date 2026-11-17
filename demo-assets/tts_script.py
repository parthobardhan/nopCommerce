SCENES = [
    ("01_title",
     "Customers are asking us about two terminal coding agents: the Cursor CLI and the Grok Build CLI. "
     "In the next five minutes, you'll see both running live on my machine, where each one wins, how each one is paid for, "
     "and where the two products are heading. For every feature, I'll tell you why it matters to your deal."),
    ("02_products",
     "Here's the one-line version. The Cursor CLI, which you run by typing agent, is Cursor's agent in the terminal. "
     "It shares the editor's models, rules, and usage pool, so for an existing Cursor customer it's an expansion, not a new purchase. "
     "The Grok Build CLI, which you run by typing grok, is SpaceXSI's open-source coding agent. It's Grok-first, and billed separately today. "
     "So your first discovery question is simple: which one does your customer mean?"),
    ("03_install",
     "Let's install both. Each one is a single curl command. Grok Build can also install through N P M, "
     "which matters for Windows fleets that block PowerShell. Now watch this. "
     "After installing both, I ask which agent runs, and it's Grok. The Grok installer also creates a command called agent, "
     "and it lands first on the path. If a customer pilots both, tell their platform team early, "
     "or developers will think they're testing one product while they're using the other."),
    ("04_task",
     "Now the same job in both. Here's a small repo with failing tests. I ask the Cursor CLI to fix them. "
     "It edits the file, and the tests pass. Same prompt in Grok Build, same result. "
     "The takeaway: the developer workflow is nearly identical. Plan mode, sessions, work trees, and agents dot m d all work the same way, "
     "so switching cost is low and adoption is fast."),
    ("05_ci",
     "Both also run headless. One flag turns the agent into a CI step that returns structured JSON, "
     "which is perfect for automated code review on every pull request. That's your expansion story: from a developer seat to every pipeline. "
     "And here's model choice. Cursor offers multiple vendors, including Anthropic, OpenAI, Google, Grok, and Composer. "
     "Grok Build is Grok-first today, with custom endpoints by config."),
    ("06_guardrails",
     "Security reviewers will ask: can it go rogue? Here I deny deletes in Cursor's permission file, and the agent is blocked. "
     "Grok Build does the same with deny rules and sandbox profiles, and grok inspect shows the login policy an admin can lock down. "
     "For the buyer, Cursor centralizes control in its dashboard, with S S O, SCIM, and Privacy Mode. "
     "Grok Build uses a fail-closed policy file pushed by M D M, zero data retention, and its source code is public for review."),
    ("07_integrations",
     "On integrations, both speak MCP, so customers reuse the tools they've already connected. "
     "Both read agents dot m d and rules files, and both embed in IDEs over the Agent Client Protocol. "
     "Cursor can also hand a task to a Cloud Agent, while Grok Build adds skills, plugins, hooks, and memory. "
     "The bottom line: no re-platforming."),
    ("08_consumption",
     "How is it paid for? The Cursor CLI draws from the same usage pool as the editor and Cloud Agents. "
     "No new P O, and more usage means expansion. The Grok Build CLI bills through the x A I API, "
     "or a SuperGrok subscription for individuals. These are two SKUs and two pools. "
     "Never paper a shared pool, and take anything combined to Deal Desk."),
    ("09_future",
     "So where is this heading? Internally, the two are becoming one: a unified Grok Build CLI that runs the Cursor agent harness, "
     "signs in with Cursor, carries over sessions and skills, and offers the full Cursor model list. "
     "Employees use it today, and select customers are testing it. "
     "What's not decided yet: the public launch date, billing, privacy terms, and any Cursor CLI end of life. "
     "This is internal, so don't share dates or promise a migration."),
    ("10_close",
     "So where do you use which? Lead with the Cursor CLI for existing Cursor customers and multi-model teams that want one contract and one admin console. "
     "Bring in Grok Build for security-led buyers who want source review, strict sandboxing in CI, or Grok-heavy, cost-sensitive work. "
     "And when you get roadmap questions, route them to product. Thanks, and go win some deals."),
]

VOICE = "perseus"

if __name__ == "__main__":
    import json, os, subprocess, urllib.request
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")
    os.makedirs(outdir, exist_ok=True)
    key = os.environ["XAI_API_KEY"]
    durations = {}
    for name, text in SCENES:
        body = json.dumps({"text": text, "voice_id": VOICE, "language": "en", "speed": 1.05}).encode()
        req = urllib.request.Request("https://api.x.ai/v1/tts", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            audio = r.read()
        path = os.path.join(outdir, f"{name}.mp3")
        open(path, "wb").write(audio)
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                           "-of", "csv=p=0", path]).decode())
        durations[name] = round(d, 2)
        print(name, durations[name])
    print("total", round(sum(durations.values()), 1))
    json.dump(durations, open(os.path.join(outdir, "durations.json"), "w"), indent=1)

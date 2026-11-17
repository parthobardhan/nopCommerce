import os, subprocess, html

A = "/tmp/build/assets"
OUT = "/tmp/build/slides"
os.makedirs(OUT, exist_ok=True)

BASE_CSS = f"""
@font-face {{ font-family: GS; src: url('file://{A}/GoogleSansVar.ttf'); font-weight: 100 900; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ width: 1920px; height: 1080px; overflow: hidden; }}
body {{ font-family: GS, Inter, sans-serif; position: relative; }}
.white {{ background: #fff; color: #000; }}
.dark {{ background: #000; color: #fff; }}
.title {{ position: absolute; left: 54px; top: 22px; font-size: 100px; font-weight: 400; letter-spacing: -1px; line-height: 1.15; }}
.sub {{ position: absolute; left: 58px; top: 160px; font-size: 34px; color: #7d8187; max-width: 1500px; line-height: 1.35; }}
.logo {{ position: absolute; left: 55px; bottom: 23px; height: 20px; }}
.conf {{ position: absolute; right: 60px; bottom: 22px; font-size: 14px; color: #7d8187; }}
.cards {{ position: absolute; left: 55px; right: 55px; top: 470px; bottom: 55px; display: grid; gap: 20px; }}
.card {{ border-radius: 14px; padding: 38px 38px; display: flex; flex-direction: column; gap: 14px; }}
.white .card {{ background: #f9f8f6; }}
.dark .card {{ background: #1a1a1a; }}
.card h3 {{ font-size: 38px; font-weight: 400; }}
.card .cmd {{ font-family: 'JetBrains Mono', 'DejaVu Sans Mono', monospace; font-size: 26px; color: #7d8187; }}
.card p {{ font-size: 28px; line-height: 1.38; color: #7d8187; }}
.card p b {{ font-weight: 500; }}
.white .card p b {{ color: #000; }}
.dark .card p b {{ color: #fff; }}
.sowhat {{ margin-top: auto; font-size: 26px; line-height: 1.35; padding-top: 16px; border-top: 1px solid rgba(125,129,135,.35); }}
.sowhat span {{ font-weight: 500; letter-spacing: 2px; font-size: 18px; display: block; margin-bottom: 6px; color: #7d8187; }}
.tag {{ display: inline-block; font-size: 15px; letter-spacing: 1.5px; font-weight: 500; padding: 4px 10px; border-radius: 999px; vertical-align: middle; margin-left: 8px; }}
.pub {{ background: #e3f1e6; color: #1d6b34; }}
.int {{ background: #e7e9ff; color: #3b3fb6; }}
.unc {{ background: #fdecd4; color: #8a5300; }}
.dark .pub {{ background: #12321c; color: #8fe0a6; }}
.dark .int {{ background: #20234d; color: #b3b7ff; }}
.dark .unc {{ background: #3d2a0c; color: #ffc876; }}
"""

def tag(kind):
    return {"pub": '<span class="tag pub">PUBLIC</span>', "int": '<span class="tag int">INTERNAL</span>',
            "unc": '<span class="tag unc">UNCONFIRMED</span>'}[kind]

def chrome(theme):
    logo = "logo_light.png" if theme == "white" else "logo_dark.png"
    return (f'<img class="logo" src="file://{A}/{logo}">'
            f'<div class="conf">Confidential · Internal, do not share externally</div>')

def page(name, theme, body, extra_css=""):
    doc = f"<html><head><style>{BASE_CSS}{extra_css}</style></head><body class='{theme}'>{body}{chrome(theme)}</body></html>"
    path = f"{OUT}/{name}.html"
    open(path, "w").write(doc)
    subprocess.run(["timeout", "12", "google-chrome", "--headless=new", "--no-first-run", "--user-data-dir=/tmp/chrome-prof", "--virtual-time-budget=3000", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", "--window-size=1920,1080",
                    f"--screenshot={OUT}/{name}.png", f"file://{path}"],
                   check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def cards(cols, items, top=470):
    out = f'<div class="cards" style="grid-template-columns: repeat({cols}, 1fr); top:{top}px">'
    for it in items:
        out += '<div class="card">' + it + "</div>"
    return out + "</div>"

def card(h, cmd=None, lines=(), sowhat=None):
    s = f"<h3>{h}</h3>"
    if cmd:
        s += f'<div class="cmd">{html.escape(cmd)}</div>'
    for l in lines:
        s += f"<p>{l}</p>"
    if sowhat:
        s += f'<div class="sowhat"><span>WHY IT MATTERS</span>{sowhat}</div>'
    return s

# 1. Title
page("01_title", "dark", f"""
<img src="file://{A}/title_bg.png" style="position:absolute;inset:0;width:1920px;height:1080px">
<div class="title" style="font-size:150px;font-weight:500;color:#fff;top:10px;line-height:1.05">Cursor CLI vs<br>Grok Build CLI</div>
<div class="sub" style="top:360px;color:#c9ccd1">Five-minute field briefing for SEs and AEs · November 2026</div>
<img src="file://{A}/spacex_mark.png" style="position:absolute;right:60px;bottom:50px;height:44px">
""", ".logo,.conf{display:none}")

# 2. Products
page("02_products", "white", '<div class="title">Two CLIs today</div>'
     '<div class="sub">Same job, a coding agent in the terminal. Different account, models and billing.</div>' +
     cards(2, [
         card("Cursor CLI", "$ agent", [
             f"Cursor's agent in the terminal: interactive, plan mode, and headless for CI {tag('pub')}",
             f"Same models, rules and usage pool as the Cursor editor {tag('pub')}"],
             "For a Cursor customer this is <b>expansion, not a new purchase</b>."),
         card("Grok Build CLI", "$ grok", [
             f"SpaceXSI's open-source coding agent (Apache 2.0, Rust). Grok-first {tag('pub')}",
             f"Separate xAI account and billing today {tag('int')}"],
             "Ask early: <b>which CLI does your customer mean?</b>"),
     ], top=300))

# 7. Integrations
page("07_integrations", "white", '<div class="title">Integrations</div>'
     '<div class="sub">Both plug into what customers already run. No re-platforming.</div>' +
     cards(4, [
         card("MCP", None, [f"Both connect to MCP servers. Cursor reuses the editor's mcp.json {tag('pub')}"],
              "Tools customers already wired up keep working."),
         card("Rules", None, [f"Both read AGENTS.md and CLAUDE.md. Cursor adds .cursor/rules {tag('pub')}"],
              "Team standards carry over on day one."),
         card("IDE embed", None, [f"Both speak ACP (Agent Client Protocol) over stdio {tag('pub')}"],
              "Runs inside JetBrains, Zed and other editors."),
         card("Extend", None, [f"Cursor: hand off to Cloud Agents with &amp; {tag('pub')}",
                               f"Grok: skills, plugins, hooks, memory {tag('pub')}"],
              "Long tasks keep running off the laptop."),
     ], top=300))

# 8. Consumption
page("08_consumption", "dark", '<div class="title">How it is paid for</div>'
     '<div class="sub">Two SKUs, two pools. Never paper a shared pool.</div>' +
     cards(2, [
         card("Cursor CLI", None, [
             f"Draws from the Cursor plan's usage pool, shared with the editor and Cloud Agents {tag('pub')}",
             f"Teams $30 / $100 / $200 per seat. Enterprise is custom {tag('pub')}"],
             "<b>No new PO.</b> More CLI and CI usage means expansion on the existing contract."),
         card("Grok Build CLI", None, [
             f"Bills through the xAI API, or SuperGrok for individuals {tag('int')}",
             f"Listed as \"Available to try for free\" on x.ai/build {tag('pub')}",
             f"Not included in a Cursor Enterprise trial {tag('int')}"],
             "<b>Separate SKU.</b> Anything combined or unified goes to Deal Desk."),
     ], top=300))

# 9a. Section divider
page("09a_section", "dark", f"""
<img src="file://{A}/section_bg.png" style="position:absolute;inset:0;width:1920px;height:1080px">
<div class="title" style="color:#fff">Where it's heading</div>
<div class="title" style="top:140px;color:#a98bff">One Grok Build CLI</div>
""")

# 9b. Future state
page("09b_future", "white", '<div class="title">The unified Grok Build CLI</div>'
     f'<div class="sub">Grok Build CLI host running the Cursor agent harness {tag("int")}</div>' +
     cards(3, [
         card("What it brings", None, [
             f"Signs in with Cursor auth {tag('int')}",
             f"Full Cursor model list, switch mid-session {tag('int')}",
             f"Carries over sessions, skills and plugins from both CLIs {tag('int')}"],
             "One install for both customer bases."),
         card("Where it is", None, [
             f"Employees on it since Nov 9 {tag('int')}",
             f"Select customers testing since mid-Oct, can switch back {tag('int')}",
             f"End-of-Oct GA target missed {tag('unc')}"],
             "Early access only, with product's OK."),
         card("Not decided", None, [
             f"Public launch date {tag('unc')}",
             f"Billing, privacy terms, admin console {tag('unc')}",
             f"Any Cursor CLI end of life {tag('unc')}"],
             "<b>Don't share dates or promise a migration.</b>"),
     ], top=300))

# 10a. Where to use which
page("10a_which", "white", '<div class="title">Where to use which</div>'
     '<div class="sub">Lead with fit, then route roadmap questions.</div>' +
     cards(3, [
         card("Lead with Cursor CLI", None, [
             "Existing Cursor customers", "Multi-model teams: Anthropic, OpenAI, Google, Grok",
             "One contract, one admin console: SSO, SCIM, Privacy Mode"],
             "Fastest path: expand the pool you already sold."),
         card("Bring in Grok Build", None, [
             "Security-led buyers who want to review the source",
             "CI that needs strict sandboxing and fail-closed policy",
             "Grok-heavy, cost-sensitive workloads"],
             "Separate SKU today. Loop in Deal Desk."),
         card("Route, don't guess", None, [
             "Launch dates and EOL: #proj-tui-unification",
             "Security questionnaires: #xai-customer-security-questionnaires",
             "Combined pricing: #deal-desk-help"],
             "Unconfirmed facts never go to customers."),
     ], top=300))

# 10b. Closing
page("10b_close", "dark", f"""
<img src="file://{A}/closing_bg.png" style="position:absolute;inset:0;width:1920px;height:1080px">
<div class="title" style="color:#fff;font-weight:500">Go win some deals</div>
<div class="sub" style="color:#c9ccd1">Deep dive: "Cursor CLI vs Grok Build CLI" GTM enablement deck · Public docs: cursor.com/docs/cli · docs.x.ai/build</div>
<img src="file://{A}/spacex_mark.png" style="position:absolute;right:60px;bottom:50px;height:44px">
""", ".logo,.conf{display:none}")

# Demo frame backgrounds: dark slide with title, caption card, and a terminal hole at (60,250) 1180x?
DEMOS = {
    "03_install": ("Live demo: install both", "On my machine, fresh home directory",
                   "Grok Build also installs an <b>agent</b> command that runs first. Customers piloting both should know before developers get confused.",
                   [f"One curl command each {tag('pub')}", f"Grok also installs via npm, useful where PowerShell is blocked {tag('pub')}"]),
    "04_task": ("Live demo: same task, both CLIs", "Fix failing tests in a small repo",
                "Developer workflow is nearly identical. <b>Low switching cost, fast adoption.</b>",
                [f"Cursor CLI: -p, plan mode, --model, --worktree {tag('pub')}",
                 f"Grok Build fixed both bugs; 3 tests pass {tag('pub')}", f"Both follow AGENTS.md {tag('pub')}"]),
    "05_ci": ("Live demo: headless for CI", "One flag returns structured JSON",
              "Automated review on every pull request. <b>From a developer seat to every pipeline.</b>",
              [f"Same flag in both: -p --output-format json {tag('pub')}",
               f"Grok JSON includes tokens and cost per run {tag('pub')}",
               f"Cursor: multi-vendor models. Grok: Grok-first {tag('pub')}"]),
    "06_guardrails": ("Live demo: guardrails", "Deny rules, sandbox, login policy",
                      "Cursor: dashboard, SSO/SCIM, Privacy Mode. Grok: fail-closed policy via MDM, public source.",
                      [f"Cursor: allow/deny in .cursor/cli.json, deny wins {tag('pub')}",
                       f"Grok: deny rules + read-only sandbox blocked the delete {tag('pub')}",
                       "Tested: deny rm alone was bypassed. Pair deny rules with a sandbox."]),
}
TERM = (55, 235, 1250, 735)  # x, y, w, h of terminal area
for name, (title, sub, why, facts) in DEMOS.items():
    facts_html = "".join(f"<p>{f}</p>" for f in facts)
    page(name + "_bg", "dark", f"""
<div style="position:absolute;left:58px;top:40px;font-size:20px;letter-spacing:3px;color:#a98bff;font-weight:500">LIVE DEMO · REAL TERMINAL · WAITS SHORTENED</div>
<div class="title" style="top:70px;font-size:72px">{title.replace('Live demo: ','')[:1].upper() + title.replace('Live demo: ','')[1:]}</div>
<div style="position:absolute;left:{TERM[0]}px;top:{TERM[1]}px;width:{TERM[2]}px;height:{TERM[3]}px;border-radius:14px;background:#0d0d0d;border:1px solid #2a2a2a"></div>
<div class="card" style="position:absolute;left:1335px;right:55px;top:{TERM[1]}px;height:{TERM[3]}px;background:#1a1a1a">
  <h3 style="font-size:30px">{sub}</h3>
  {facts_html}
  <div class="sowhat"><span>WHY IT MATTERS</span>{why}</div>
</div>
""", ".card p{font-size:24px}.sowhat{font-size:24px}")

print("done", sorted(os.listdir(OUT)))

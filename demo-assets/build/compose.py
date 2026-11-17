"""Assemble the final video from slides, terminal clips and per-scene voiceover."""
import json, os, re, subprocess, sys

sys.path.insert(0, "/tmp/build")
from script import SCENES

B = "/tmp/build"
SL = f"{B}/slides"
AUD = sys.argv[1] if len(sys.argv) > 1 else f"{B}/audio"
SEG = f"{B}/segments"
os.makedirs(SEG, exist_ok=True)
TEXT = dict(SCENES)
TERM_BOX = (55, 235, 1250, 735)
PAD = 0.5  # silence after each scene's narration


def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", path]).decode())


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


# Visual plan: list of (kind, source, share). share = fraction of scene time.
PLAN = {
    "01_title": [("img", "01_title", 1)],
    "02_products": [("img", "02_products", 1)],
    "03_install": [("term", ("03_install_bg", ["install"]), 1)],
    "04_task": [("term", ("04_task_bg", ["cursorflags", "sceneB"]), 1)],
    "05_ci": [("term", ("05_ci_bg", ["sceneC", "sceneD"]), 1)],
    "06_guardrails": [("term", ("06_guardrails_bg", ["sceneE"]), 1)],
    "07_integrations": [("img", "07_integrations", 1)],
    "08_consumption": [("img", "08_consumption", 1)],
    "09_future": [("img", "09a_section", 0.13), ("img", "09b_future", 0.87)],
    "10_close": [("img", "10a_which", 0.8), ("img", "10b_close", 0.2)],
}


def term_clip(names, total, out):
    """Concatenate terminal clips, each retimed to an equal share of `total` seconds."""
    parts = []
    share = total / len(names)
    for i, n in enumerate(names):
        src = f"{B}/clips/{n}.mp4"
        d = dur(src)
        factor = min(1.0, share / d)  # only speed up, never slow down
        p = f"{SEG}/_t{i}.mp4"
        hold = max(0.0, share - d * factor)
        run(["ffmpeg", "-y", "-i", src, "-vf",
             f"setpts={factor}*PTS,fps=30,tpad=stop_mode=clone:stop_duration={hold:.2f}",
             "-t", f"{share:.2f}", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", p])
        parts.append(p)
    lst = f"{SEG}/_t.txt"
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out])


def visual(kind, src, d, out):
    if kind == "img":
        run(["ffmpeg", "-y", "-loop", "1", "-framerate", "30", "-i", f"{SL}/{src}.png", "-t", f"{d:.2f}",
             "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "18", "-tune", "stillimage", out])
    else:
        bg, names = src
        tc = f"{SEG}/_term.mp4"
        term_clip(names, d, tc)
        x, y, w, h = TERM_BOX
        run(["ffmpeg", "-y", "-loop", "1", "-framerate", "30", "-i", f"{SL}/{bg}.png", "-i", tc,
             "-filter_complex",
             f"[1:v]scale={w-30}:{h-30}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[t];[0:v][t]overlay=x={x}+({w}-overlay_w)/2:y={y}+15:shortest=1,format=yuv420p",
             "-t", f"{d:.2f}", "-c:v", "libx264", "-crf", "18", out])


def ass_time(t):
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def captions(text, d):
    """Split narration into short lines and time them by character count."""
    sents = re.split(r"(?<=[.?!:])\s+", text)
    chunks = []
    for s in sents:
        words = s.split()
        while words:
            line = []
            while words and len(" ".join(line + [words[0]])) <= 70:
                line.append(words.pop(0))
            if not line:
                line.append(words.pop(0))
            chunks.append(" ".join(line))
    total = sum(len(c) for c in chunks)
    t, ev = 0.0, []
    for c in chunks:
        span = d * len(c) / total
        ev.append((t, t + span, c))
        t += span
    return ev


def main():
    segs, events, clock = [], [], 0.0
    for name, _ in SCENES:
        a = f"{AUD}/{name}.mp3"
        ad = dur(a)
        d = ad + PAD + (2.0 if name == "10_close" else 0)
        vparts = []
        for i, (kind, src, share) in enumerate(PLAN[name]):
            vp = f"{SEG}/{name}_v{i}.mp4"
            visual(kind, src, d * share, vp)
            vparts.append(vp)
        lst = f"{SEG}/{name}_v.txt"
        open(lst, "w").write("".join(f"file '{p}'\n" for p in vparts))
        vcat = f"{SEG}/{name}_vcat.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vcat])
        seg = f"{SEG}/{name}.mp4"
        run(["ffmpeg", "-y", "-i", vcat, "-i", a, "-filter_complex",
             f"[1:a]aresample=48000,apad=whole_dur={d:.2f}[a];[0:v]fade=in:st=0:d=0.25,fade=out:st={d-0.25:.2f}:d=0.25[v]",
             "-map", "[v]", "-map", "[a]", "-t", f"{d:.2f}", "-c:v", "libx264", "-crf", "18",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", seg])
        for s, e, c in captions(TEXT[name], ad):
            events.append((clock + s, clock + e, c))
        clock += dur(seg)
        segs.append(seg)
        print(name, round(d, 1), "->", round(clock, 1), flush=True)

    lst = f"{SEG}/all.txt"
    open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
    raw = f"{B}/raw.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", raw])

    ass = f"{B}/captions.ass"
    with open(ass, "w") as f:
        f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\n"
                "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, "
                "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\n"
                "Style: Cap,Google Sans,54,&H00FFFFFF,&H00000000,&HB0000000,0,0,3,12,0,2,200,200,8\n\n"
                "[Events]\nFormat: Layer, Start, End, Style, Text\n")
        for s, e, c in events:
            f.write(f"Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,{c}\n")
    final = "/opt/cursor/artifacts/cursor-cli-vs-grok-build-cli.mp4"
    os.makedirs("/opt/cursor/artifacts", exist_ok=True)
    run(["ffmpeg", "-y", "-i", raw, "-vf", f"ass={ass}:fontsdir={B}/assets", "-c:v", "libx264", "-crf", "20",
         "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", final])
    print("final", final, round(dur(final), 1))


if __name__ == "__main__":
    main()

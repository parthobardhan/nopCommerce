"""Drop command blocks from an asciicast whose typed command matches a pattern, closing the time gaps."""
import json, re, sys

PROMPT = "\x1b[32m$ \x1b[0m"


def blocks(events):
    cur = []
    for e in events:
        if e[1] == "o" and e[2].startswith(PROMPT) and cur:
            yield cur
            cur = []
        cur.append(e)
    if cur:
        yield cur


def command_of(block):
    text = "".join(e[2] for e in block if e[1] == "o")
    return text[len(PROMPT):].split("\r\n", 1)[0] if text.startswith(PROMPT) else ""


def main(src, dst, drop_pattern):
    lines = open(src).read().splitlines()
    header, events = lines[0], [json.loads(l) for l in lines[1:] if l.strip()]
    out, shift, kept, dropped = [], 0.0, [], []
    for b in blocks(events):
        start = b[0][0]
        end = b[-1][0]
        cmd = command_of(b)
        if re.search(drop_pattern, cmd):
            dropped.append(cmd)
            shift += end - start + 0.3
            continue
        kept.append(cmd)
        for e in b:
            out.append([round(e[0] - shift, 6), e[1], e[2]])
    with open(dst, "w") as f:
        f.write(header + "\n")
        for e in out:
            f.write(json.dumps(e) + "\n")
    print("kept:", kept)
    print("dropped:", dropped)


if __name__ == "__main__":
    main(*sys.argv[1:4])

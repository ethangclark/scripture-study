"""Build a reader page for one volume: embeds its JSON (with abridgement fields) into template.html.

Usage:
  python3 build.py [bom|ot]   -> writes <vol>.html for publishing as an Artifact
                                 (bom also writes index.html)
  python3 build.py site       -> writes _site/ for Cloudflare Workers: a landing page
                                 plus bom/ and ot/ readers
"""
import json
import os
import shutil
import sys

VOLUMES = {
    "bom": {
        "src": "../scriptures-json/book-of-mormon.json",
        "name": "Book of Mormon", "eyebrow": "The Book of Mormon", "source": "the 2013 edition",
        "abbrev": {"1 Nephi": "1 Ne", "2 Nephi": "2 Ne", "3 Nephi": "3 Ne", "4 Nephi": "4 Ne",
                   "Words of Mormon": "W of M", "Helaman": "Hel", "Mormon": "Morm", "Moroni": "Moro"},
    },
    "ot": {
        "src": "../scriptures-json/old-testament.json",
        "name": "Old Testament", "eyebrow": "The Old Testament", "source": "the King James Version",
        "abbrev": {"Genesis": "Gen", "Exodus": "Ex", "Leviticus": "Lev", "Numbers": "Num",
                   "Deuteronomy": "Deut", "Joshua": "Josh", "Judges": "Judg", "1 Samuel": "1 Sam",
                   "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr",
                   "2 Chronicles": "2 Chr", "Nehemiah": "Neh", "Esther": "Esth", "Psalms": "Ps",
                   "Proverbs": "Prov", "Ecclesiastes": "Eccl", "Solomon's Song": "Song", "Isaiah": "Isa",
                   "Jeremiah": "Jer", "Lamentations": "Lam", "Ezekiel": "Ezek", "Daniel": "Dan",
                   "Obadiah": "Obad", "Habakkuk": "Hab", "Zephaniah": "Zeph", "Haggai": "Hag",
                   "Zechariah": "Zech", "Malachi": "Mal"},
    },
}


def load(vol):
    cfg = VOLUMES[vol]
    d = json.load(open(cfg["src"], encoding="utf-8"))
    books = []
    for b in d["books"]:
        chapters = []
        for c in b["chapters"]:
            verses = []
            for v in c["verses"]:
                e = [v["text"], 1 if v["survivesAbridgement"] else 0]
                if "abridgementBridge" in v:
                    e.append(v["abridgementBridge"])
                verses.append(e)
            chapters.append(verses)
        books.append({"n": b["book"], "a": cfg["abbrev"].get(b["book"], b["book"]), "s": b["lds_slug"], "c": chapters})
    return books


def render(vol, library=""):
    cfg = VOLUMES[vol]
    data = json.dumps(load(vol), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = open("template.html", encoding="utf-8").read()
    for k, v in {"__NAME__": cfg["name"], "__EYEBROW__": cfg["eyebrow"], "__SOURCE__": cfg["source"],
                 "__KEY__": vol + "-abr", "__VOLUME__": vol, "__ACCOUNT__": open("account.html", encoding="utf-8").read(), "__LIBRARY__": library, "__DATA__": data}.items():
        html = html.replace(k, v)
    return html


def build(vol):
    html = render(vol)
    out = f"{vol}.html"
    open(out, "w", encoding="utf-8").write(html)
    if vol == "bom":
        shutil.copy(out, "index.html")
    print("wrote", out, len(html.encode()), "bytes")


# Artifacts wrap pages in a document skeleton with a small reset; standalone
# pages supply their own.
def standalone(html):
    head, body = html.split("</style>", 1)
    reset = "html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}\n"
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + head.replace("<style>", "<style>\n" + reset, 1) + "</style>\n</head>\n<body>\n"
            + body + "\n</body>\n</html>\n")


# The library and readers use the same authenticated bookmark service.
LIBRARY_BOOKMARKS_JS = """<script>
function syncLibraryBookmarks() {
  const names = { bom: "Book of Mormon", ot: "Old Testament" };
  const ul = document.getElementById("libbm-l");
  ul.replaceChildren();
  ScriptureAccount.bookmarks.forEach(mark => {
    const li = document.createElement("li"), a = document.createElement("a"), t = document.createElement("span"), m = document.createElement("span");
    a.className = "vol"; a.href = mark.volume + "/#" + mark.slug;
    t.className = "t"; t.textContent = mark.ref; m.className = "m"; m.textContent = names[mark.volume];
    a.append(t, m); li.append(a); ul.append(li);
  });
  document.getElementById("libbm").hidden = !ScriptureAccount.username;
}
window.addEventListener("bookmarkschange", syncLibraryBookmarks);
ScriptureAccount.ready.then(syncLibraryBookmarks);
</script>"""


def site():
    shutil.rmtree("_site", ignore_errors=True)
    link = '<a class="lib-link" href="../" aria-label="All volumes">← All volumes</a>'
    for vol in VOLUMES:
        os.makedirs(f"_site/{vol}", exist_ok=True)
        open(f"_site/{vol}/index.html", "w", encoding="utf-8").write(standalone(render(vol, link)))
    # Landing page: reuse the reader's head and tokens.
    tmpl = open("template.html", encoding="utf-8").read()
    head = tmpl.split("</style>", 1)[0].replace("__NAME__, Abridged", "Scriptures, Abridged")
    rows = ""
    for vol, cfg in VOLUMES.items():
        books = load(vol)
        n = sum(len(vs) for b in books for vs in b["c"])
        k = sum(v[1] for b in books for vs in b["c"] for v in vs)
        rows += (f'<li><a class="vol" href="{vol}/"><span class="t">{cfg["name"]}</span>'
                 f'<span class="m">{k:,} of {n:,} verses · {len(books)} books</span></a></li>')
    extra = """
.lib { max-width: var(--measure); margin: 0 auto; padding-inline: 16px; padding-block: 3rem 4rem; }
.lib h1 { font-family: var(--display); font-weight: 500; font-size: clamp(2.2rem, 7vw, 3.4rem); line-height: 1.05; margin: 0.3rem 0 0.75rem; text-wrap: balance; }
.lib ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--rule); }
.lib li { border-bottom: 1px solid var(--rule); }
.vol { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.25rem 1rem; padding: 1rem 0; color: inherit; text-decoration: none; }
.vol .t { font-family: var(--display); font-size: 1.6rem; font-weight: 600; }
.vol:hover .t { color: var(--brass); }
.vol .m { font-family: var(--ui); font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.libbm h2 { font-family: var(--ui); font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brass); font-weight: 500; margin: 2.5rem 0 0.6rem; }
.libbm .vol .t { font-size: 1.2rem; }
"""
    body = (open("account.html", encoding="utf-8").read() + '<main class="lib"><p class="eyebrow">Scripture study</p><h1>Scriptures, abridged</h1>'
            '<p class="lede">Each volume keeps half its verses, chosen to keep the story moving and the teaching whole, '
            'with short notes wherever a cut would leave you lost. Every reader can switch to the full text.</p>'
            f'<ul>{rows}</ul><section class="libbm" id="libbm" hidden><h2>Bookmarks</h2><ul id="libbm-l"></ul></section>'
            '<p class="fine">Text via the public-domain scriptures-json project. '
            'An editorial abridgement, not an official edition.</p></main>' + LIBRARY_BOOKMARKS_JS)
    open("_site/index.html", "w", encoding="utf-8").write(standalone(head + extra + "</style>" + body))
    shutil.copy("account.js", "_site/account.js")
    shutil.copy("_headers", "_site/_headers")
    catalogue = {vol: [{"name": b["n"], "slug": b["s"], "chapters": [len(c) for c in b["c"]]} for b in load(vol)] for vol in VOLUMES}
    os.makedirs("../worker", exist_ok=True)
    open("../worker/catalog.json", "w", encoding="utf-8").write(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")))
    print("wrote _site/:", sorted(os.listdir("_site")))


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "bom"
    site() if arg == "site" else build(arg)

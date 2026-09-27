"""Build a reader page for one volume: embeds its JSON (with abridgement fields) into template.html.

Usage: python3 build.py [bom|ot]   -> writes <vol>.html (bom also writes index.html)
"""
import json
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


def build(vol):
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
    data = json.dumps(books, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = open("template.html", encoding="utf-8").read()
    for k, v in {"__NAME__": cfg["name"], "__EYEBROW__": cfg["eyebrow"], "__SOURCE__": cfg["source"],
                 "__KEY__": vol + "-abr", "__DATA__": data}.items():
        html = html.replace(k, v)
    out = f"{vol}.html"
    open(out, "w", encoding="utf-8").write(html)
    if vol == "bom":
        shutil.copy(out, "index.html")
    print("wrote", out, len(html.encode()), "bytes")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "bom")

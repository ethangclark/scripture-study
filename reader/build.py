"""Build the reader page: embeds the Book of Mormon (with abridgement fields) into template.html."""
import json

d = json.load(open("../scriptures-json/book-of-mormon.json", encoding="utf-8"))
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
    books.append({"n": b["book"], "s": b["lds_slug"], "c": chapters})
data = json.dumps(books, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = open("template.html", encoding="utf-8").read().replace("__DATA__", data)
open("index.html", "w", encoding="utf-8").write(html)
print("wrote index.html", len(html.encode()), "bytes")

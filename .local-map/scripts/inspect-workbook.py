#!/usr/bin/env python3
"""Print what is really stored in a spreadsheet file, without opening a spreadsheet app.

Usage:  python3 -I .local-map/scripts/inspect-workbook.py <file.xlsx | file.csv>

Why: a spreadsheet app hides the things that break parsers (which row is first, whether a cell is
text or a number, date formats, merged ranges, line endings). This shows them. It uses only the
Python standard library, so it can be run on a file nobody trusts yet.
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def text_of(node):
    """All text inside a node, e.g. the pieces of a rich-text string."""
    return "".join(t.text or "" for t in node.iter("{%s}t" % NS["m"]))


def dump_xlsx(path):
    book = zipfile.ZipFile(path)
    names = book.namelist()

    shared = []
    if "xl/sharedStrings.xml" in names:
        root = ET.fromstring(book.read("xl/sharedStrings.xml"))
        shared = [text_of(si) for si in root.findall("m:si", NS)]

    # Sheet name -> file inside the zip, through the workbook relationships.
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels}
    workbook = ET.fromstring(book.read("xl/workbook.xml"))

    for sheet in workbook.find("m:sheets", NS):
        file = "xl/" + target[sheet.get(REL)].lstrip("/").removeprefix("xl/")
        root = ET.fromstring(book.read(file))
        dimension = root.find("m:dimension", NS)
        merges = [m.get("ref") for m in root.iter("{%s}mergeCell" % NS["m"])]
        print(f"=== sheet {sheet.get('name')!r}  state={sheet.get('state', 'visible')}"
              f"  range={dimension.get('ref') if dimension is not None else '?'}"
              f"  merged={merges or 'none'}")

        for row in root.iter("{%s}row" % NS["m"]):
            cells = []
            for c in row.findall("m:c", NS):
                kind = c.get("t", "n")  # n = number (the default), s = shared string, ...
                v = c.find("m:v", NS)
                if kind == "s" and v is not None:
                    value = shared[int(v.text)]
                elif kind == "inlineStr":
                    value = text_of(c)
                else:
                    value = v.text if v is not None else ""
                formula = c.find("m:f", NS)
                column = re.match(r"[A-Z]+", c.get("r")).group()
                note = "" if kind in ("s", "inlineStr") else f"<{kind}>"
                note += f"[={formula.text}]" if formula is not None else ""
                cells.append(f"{column}={value!r}{note}")
            hidden = "  (hidden row)" if row.get("hidden") == "1" else ""
            print(f"{int(row.get('r')):>4}  " + " | ".join(cells) + hidden)
        print()


def dump_text(path):
    data = open(path, "rb").read()
    bom = "UTF-8 BOM" if data[:3] == b"\xef\xbb\xbf" else "no BOM"
    endings = "CRLF" if b"\r\n" in data else "LF"
    first = data.split(b"\n", 1)[0].decode("utf-8", "replace")
    counts = {d: first.count(d) for d in [",", ";", "\t", "|"]}
    print(f"=== text file  {len(data)} bytes  {bom}  {endings}  delimiters in line 1: {counts}")
    for number, line in enumerate(data.decode("utf-8", "replace").splitlines(), start=1):
        print(f"{number:>4}  {line!r}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    file = sys.argv[1]
    dump_xlsx(file) if zipfile.is_zipfile(file) else dump_text(file)

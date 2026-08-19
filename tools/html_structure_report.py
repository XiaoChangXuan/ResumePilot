from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from autofill.parser.html_dom import parse_dom
from autofill.parser.semantic_tree import build_semantic_tree, clean, summarize_document


def nonempty_counts(counts: dict[str, Any]) -> dict[str, Any] | None:
    compact = {key: value for key, value in counts.items() if value}
    return compact or None


def with_counts(counts: dict[str, Any]) -> dict[str, dict[str, Any]]:
    compact = nonempty_counts(counts)
    return {"counts": compact} if compact else {}


def compact_report(report: dict[str, Any]) -> dict[str, Any]:
    top_counts = report.get("counts") or {
        "control_count": report.get("control_count", 0),
        "interactive_count": report.get("interactive_count", 0),
        "field_like_count": report.get("field_like_count", 0),
        "title_like_count": report.get("title_like_count", 0),
    }
    return {
        "node_count": report["node_count"],
        **with_counts(top_counts),
        "zones": [
            {
                "zone": zone["zone"],
                "node_count": zone["node_count"],
                **with_counts(zone.get("counts", {})),
            }
            for zone in report["zones"]
            if zone["node_count"] or zone.get("counts")
        ],
        "page_blocks": [
            {
                "index": module["index"],
                "kind": module["kind"],
                "title": module["title"],
                "zone": module["zone"],
                **with_counts(module.get("counts", {})),
                "path": module["path"],
                "text": clean(module["text"], 100),
            }
            for module in report.get("page_blocks", report.get("page_modules", []))
        ],
        "modules": [
            {
                "index": module["index"],
                "title": module["title"],
                "zone": module["zone"],
                **with_counts(module.get("counts", {})),
                "path": module["path"],
                "title_path": module["title_path"],
                "text": clean(module["text"], 100),
            }
            for module in report["modules"]
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a semantic whole-page structure report from static HTML.")
    parser.add_argument("html", type=Path)
    parser.add_argument("--compact", action="store_true", help="Only include high-signal zone/module fields.")
    parser.add_argument("--out", type=Path, help="Write JSON report to this file instead of stdout.")
    args = parser.parse_args()

    root = parse_dom(args.html.read_text(encoding="utf-8", errors="replace"))
    tree = build_semantic_tree(root)
    report: dict[str, Any] = {
        "source": str(args.html),
        **summarize_document(tree),
    }
    if args.compact:
        report = {"source": str(args.html), **compact_report(report)}

    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
        print(str(args.out))
        return
    sys.stdout.reconfigure(encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()

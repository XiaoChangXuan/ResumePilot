from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from autofill.parser import parse_html


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse an HTML snapshot into Form IR.")
    parser.add_argument("snapshot", type=Path, help="HTML file or JSON copied from the extension snapshot button.")
    parser.add_argument("--page", default="resume")
    args = parser.parse_args()

    text = args.snapshot.read_text(encoding="utf-8")
    if args.snapshot.suffix.lower() == ".json":
        text = json.loads(text).get("html", "")
    ir = parse_html(text, page=args.page)
    print(json.dumps(ir.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

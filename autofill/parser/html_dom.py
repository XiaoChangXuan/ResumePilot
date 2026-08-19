from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Iterable


VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


@dataclass(slots=True)
class Node:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    parent: "Node | None" = None
    children: list["Node"] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)

    def append(self, child: "Node") -> None:
        child.parent = self
        self.children.append(child)

    def text_content(self) -> str:
        parts: list[str] = []

        def walk(node: Node) -> None:
            parts.extend(node.text_parts)
            for child in node.children:
                walk(child)

        walk(self)
        return " ".join(" ".join(parts).split())

    def attr(self, name: str, default: str = "") -> str:
        return self.attrs.get(name, default)

    def has_class_fragment(self, fragment: str) -> bool:
        return fragment.lower() in self.attr("class").lower()

    def walk(self) -> Iterable["Node"]:
        yield self
        for child in self.children:
            yield from child.walk()

    def ancestors(self) -> Iterable["Node"]:
        node = self.parent
        while node is not None:
            yield node
            node = node.parent

    def previous_sibling_text(self) -> str:
        if not self.parent:
            return ""
        siblings = self.parent.children
        try:
            index = siblings.index(self)
        except ValueError:
            return ""
        texts: list[str] = []
        for sibling in reversed(siblings[:index]):
            text = sibling.text_content()
            if text:
                texts.append(text)
            if len(texts) >= 2:
                break
        return " ".join(reversed(texts))


class DomBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), {name.lower(): value or "" for name, value in attrs})
        self.stack[-1].append(node)
        if node.tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if text:
            self.stack[-1].text_parts.append(text)


def parse_dom(html: str) -> Node:
    parser = DomBuilder()
    parser.feed(html)
    parser.close()
    return parser.root

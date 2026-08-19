from __future__ import annotations

import re

from .field_parser import is_control, parse_fields
from .form_ir import FormIR, ModuleIR
from .html_dom import Node, parse_dom


MODULE_ROOT_TAGS = {"section", "fieldset", "form"}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "legend"}
MODULE_HINT_RE = re.compile(r"基本信息|基础信息|个人信息|联系信息|basic|personal|profile", re.I)


def clean(value: str) -> str:
    return " ".join(str(value or "").split()).strip(" :：")


def page_title(root: Node) -> str:
    for node in root.walk():
        if node.tag == "title":
            return clean(node.text_content())
    return ""


def has_controls(node: Node) -> bool:
    return any(is_control(child) for child in node.walk())


def first_heading(node: Node) -> str:
    for child in node.walk():
        if child is node:
            continue
        if child.tag in HEADING_TAGS or child.attr("role") == "heading":
            text = clean(child.text_content())
            if text:
                return text
        class_name = child.attr("class").lower()
        if "title" in class_name or "heading" in class_name:
            text = clean(child.text_content())
            if text:
                return text
    return ""


def module_key(title: str) -> str:
    if re.search(r"基本信息|基础信息|个人信息|联系信息|basic|personal|profile", title, re.I):
        return "basic_info"
    if re.search(r"教育|学历|education|academic", title, re.I):
        return "education"
    if re.search(r"工作|实习|experience|employment|intern", title, re.I):
        return "experience"
    return "unknown"


def module_candidates(root: Node) -> list[tuple[Node, str]]:
    candidates: list[tuple[Node, str]] = []
    for node in root.walk():
        if node.tag not in MODULE_ROOT_TAGS and "section" not in node.attr("class").lower():
            continue
        if not has_controls(node):
            continue
        title = first_heading(node)
        if title and MODULE_HINT_RE.search(title):
            candidates.append((node, title))
    if candidates:
        return [
            (node, title)
            for node, title in candidates
            if not any(other is not node and node in other.ancestors() for other, _ in candidates)
        ]
    for node in root.walk():
        if node.tag == "form" and has_controls(node):
            return [(node, first_heading(node) or "页面表单")]
    return [(root, page_title(root) or "页面")]


def parse_html(html: str, page: str = "resume") -> FormIR:
    root = parse_dom(html)
    modules: list[ModuleIR] = []
    for index, (node, title) in enumerate(module_candidates(root), start=1):
        module_id = f"module_{index:03d}"
        fields = parse_fields(node, title, id_prefix=f"{module_id}_field")
        modules.append(
            ModuleIR(
                module_id=module_id,
                module=module_key(title),
                title=title,
                fields=fields,
                evidence={
                    "tag": node.tag,
                    "id": node.attr("id"),
                    "class": node.attr("class"),
                    "field_count": len(fields),
                },
            )
        )
    return FormIR(page=page, title=page_title(root), modules=modules)

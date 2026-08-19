from __future__ import annotations

from .form_ir import FieldIR
from .html_dom import Node


CONTROL_TAGS = {"input", "textarea", "select"}
LABEL_CLASS_HINTS = ("label", "title", "fieldname", "field-name", "form-item-label")


def clean(value: str) -> str:
    return " ".join(str(value or "").replace("*", " ").split()).strip(" :：")


def is_control(node: Node) -> bool:
    if node.tag not in CONTROL_TAGS:
        return False
    if node.tag == "input" and node.attr("type").lower() == "hidden":
        return False
    return True


def control_hint(node: Node) -> str:
    if node.tag == "textarea":
        return "textarea"
    if node.tag == "select":
        return "select"
    input_type = node.attr("type", "text").lower() or "text"
    if input_type in {"radio", "checkbox", "file", "date", "month", "email", "tel", "number"}:
        return input_type
    return "text"


def labels_by_for(root: Node) -> dict[str, str]:
    labels: dict[str, str] = {}
    for node in root.walk():
        if node.tag != "label" or not node.attr("for"):
            continue
        labels[node.attr("for")] = clean(node.text_content())
    return labels


def wrapping_label(control: Node) -> str:
    for ancestor in control.ancestors():
        if ancestor.tag == "label":
            return clean(ancestor.text_content())
    return ""


def ancestor_label(control: Node) -> tuple[str, str]:
    for ancestor in control.ancestors():
        for child in ancestor.children:
            class_name = child.attr("class").lower()
            if child is control or control in child.walk():
                continue
            if child.tag in {"label", "legend", "dt", "th"} or any(hint in class_name for hint in LABEL_CLASS_HINTS):
                text = clean(child.text_content())
                if text:
                    return text, f"ancestor-{child.tag}"
    return "", ""


def label_for_control(control: Node, root: Node, labels: dict[str, str]) -> tuple[str, str]:
    control_id = control.attr("id")
    if control_id and labels.get(control_id):
        return labels[control_id], "label-for"
    text = wrapping_label(control)
    if text:
        return text, "wrapping-label"
    text, source = ancestor_label(control)
    if text:
        return text, source
    text = clean(control.previous_sibling_text())
    if text:
        return text, "previous-sibling"
    text = clean(control.attr("aria-label") or control.attr("placeholder") or control.attr("name") or control.attr("id"))
    if text:
        return text, "control-attribute"
    return "", "unknown"


def parse_fields(module_root: Node, module_title: str, id_prefix: str = "field") -> list[FieldIR]:
    labels = labels_by_for(module_root)
    fields: list[FieldIR] = []
    seen_controls: set[int] = set()
    for node in module_root.walk():
        if not is_control(node):
            continue
        identity = id(node)
        if identity in seen_controls:
            continue
        seen_controls.add(identity)
        label, source = label_for_control(node, module_root, labels)
        fields.append(
            FieldIR(
                field_id=f"{id_prefix}_{len(fields) + 1:03d}",
                label=label,
                control=control_hint(node),
                placeholder=node.attr("placeholder"),
                name=node.attr("name"),
                id=node.attr("id"),
                aria_label=node.attr("aria-label"),
                context=module_title,
                evidence={
                    "label_source": source,
                    "tag": node.tag,
                    "type": node.attr("type"),
                    "class": node.attr("class"),
                },
            )
        )
    return fields

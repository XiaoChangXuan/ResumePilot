from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from autofill.parser.html_dom import Node, parse_dom


CONTROL_TAGS = {"input", "textarea", "select", "button"}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "legend"}
LABEL_TAGS = {"label", "legend", "dt", "th"}
FIELD_CONTAINER_TOKENS = ("form-item", "el-form-item", "ant-form-item", "rocket-form-field-item", "info_box")
FIELD_CONTAINER_HINTS = ("atsx-form-item", "apply-field-")
FIELD_CONTROL_HINTS = (
    "form-item__content",
    "form-item__control",
    "el-form-item__content",
    "ant-form-item-control",
    "ant-form-item-control-wrapper",
    "rocket-form-field-item-control",
    "input_box",
)
FIELD_LABEL_HINTS = (
    "subtitle",
    "form-item__text",
    "form-item-label",
    "form-item__label",
    "el-form-item__label",
    "ant-form-item-label",
    "rocket-form-field-item-label",
    "ud-formily-item-label",
    "field-label",
    "title-",
)
TITLE_DESCRIPTION_HINTS = (
    "title_text",
    "describe",
    "description",
    "help",
    "tip",
    "Tip",
    "remark",
    "note",
)
MODULE_TITLE_HINTS = (
    "send_title",
    "divider-title_title",
    "sc-efQSVx",
    "section-title",
    "module-title",
    "modules-title",
    "createFormSection-title",
    "createFormSection-text",
    "applyFormModuleWrapper-title",
    "applyFormModuleWrapper-text",
    "blockTitle-",
)
MODULE_CONTAINER_TOKENS = ("cv-module", "createFormSection-container", "applyFormModuleWrapper-windows", "send_box")
MODULE_CONTAINER_HINTS = (
    "createFormSection-container",
    "applyFormModuleWrapper-",
    "sc-iAKWXU",
    "apply-block-",
)
RECORD_CARD_HINTS = ("apply-form-array-card",)
ADD_ACTION_HINTS = (
    "newAdd",
    "addMore",
    "addBtn",
    "addButton",
    "_addButton",
    "formOperate-addBtn",
    "createFormSection-addBtn",
    "apply-form-array-card-add",
)
CONTROL_CLASS_HINTS = (
    "phoenix-input",
    "phoenix-select",
    "phoenix-radio",
    "phoenix-checkbox",
    "phoenix-date",
    "phoenix-button",
    "el-input",
    "el-select",
    "el-radio",
    "el-checkbox",
    "el-date-editor",
    "el-cascader",
    "el-upload",
    "file-uploader__button",
    "edui-body-container",
    "ud__native-input",
    "ud__input",
    "ud__input-number",
    "ud__select",
    "ud__radio",
    "ud__checkbox",
    "ud__textarea",
    "ud__picker",
    "atsx-upload",
)
MODULE_TITLE_PATTERN = re.compile(
    r"(?:"
    r"\u4e0a\u4f20|\u7b80\u5386|\u4e2a\u4eba|\u57fa\u672c|\u57fa\u7840|\u8054\u7cfb|\u6c42\u804c|"
    r"\u6559\u80b2|\u5b66\u5386|\u5b66\u4e60|\u5c31\u8bfb|\u6821\u56ed|\u5b9e\u4e60|\u5de5\u4f5c|"
    r"\u9879\u76ee|\u7ecf\u5386|\u7ecf\u9a8c|\u5b9e\u8df5|\u8bed\u8a00|\u5916\u8bed|\u82f1\u8bed|\u6280\u80fd|"
    r"\u8bc1\u4e66|\u83b7\u5956|\u8363\u8a89|\u9644\u4ef6|\u4f5c\u54c1|\u5bb6\u5ead|\u81ea\u6211|"
    r"\u8bc4\u4ef7|\u793e\u4ea4|\u8d26\u53f7|\u5176\u4ed6|basic|personal|contact|education|academic|school|work|job|"
    r"intern|project|experience|language|skill|certificate|award|honou?r|attachment|profile"
    r")",
    re.I,
)
DATE_TEXTS = {"\u5e74", "\u6708", "\u65e5", "YYYY", "yyyy", "MM", "mm", "DD", "dd", "year", "month", "day"}
DATE_FIELD_PATTERN = re.compile(
    r"(?:"
    r"\u65f6\u95f4|\u65e5\u671f|\u6bd5\u4e1a|\u51fa\u751f|\u5230\u5c97|\u83b7\u5956|\u8bc1\u4e66|"
    r"date|time|year|month"
    r")",
    re.I,
)
DATE_RANGE_PATTERN = re.compile(
    r"(?:"
    r"\u8d77\u6b62|\u5f00\u59cb.*\u7ed3\u675f|\u5c31\u8bfb|\u5728\u6821|\u5de5\u4f5c\u65f6\u95f4|"
    r"\u5b9e\u4e60\u65f6\u95f4|\u9879\u76ee\u65f6\u95f4|period|range|start.*end"
    r")",
    re.I,
)
_HAS_CONTROL_DESCENDANT_CACHE: dict[int, bool] = {}
_HAS_DESCENDANT_EXPLICIT_FIELD_CACHE: dict[int, bool] = {}


def clear_static_caches() -> None:
    _HAS_CONTROL_DESCENDANT_CACHE.clear()
    _HAS_DESCENDANT_EXPLICIT_FIELD_CACHE.clear()


def clean(value: str, limit: int = 240) -> str:
    text = " ".join(str(value or "").replace("\xa0", " ").split()).strip(" :：")
    return text[:limit]


def normalize_label_text(value: str, limit: int = 120) -> str:
    text = clean(value, limit)
    text = re.sub(r"[\s*＊]+$", "", text)
    text = re.sub(r"[：:]+$", "", text)
    return clean(text, limit)


def class_name(node: Node) -> str:
    return node.attr("class")


def has_class_fragment(node: Node, fragments: tuple[str, ...]) -> bool:
    classes = class_name(node)
    return any(fragment in classes for fragment in fragments)


def has_class_token(node: Node, token: str) -> bool:
    return token in class_name(node).split()


def has_explicit_module_marker(node: Node) -> bool:
    return any(has_class_token(node, token) for token in MODULE_CONTAINER_TOKENS) or has_class_fragment(node, MODULE_CONTAINER_HINTS)


def is_explicit_field_container(node: Node) -> bool:
    classes = class_name(node)
    if any(fragment in classes for fragment in FIELD_CONTROL_HINTS):
        return False
    if has_class_token(node, "ud-formily-item"):
        return bool(node.attr("data-form-field-i18n-name") or node.attr("data-form-field-name"))
    return any(has_class_token(node, token) for token in FIELD_CONTAINER_TOKENS) or has_class_fragment(node, FIELD_CONTAINER_HINTS)


def direct_own_text(node: Node, limit: int = 120) -> str:
    return clean(" ".join(node.text_parts), limit)


def control_descendants(node: Node) -> list[Node]:
    return compact_controls([child for child in node.walk() if child is not node and is_control(child)])


def has_control_descendant(node: Node) -> bool:
    key = id(node)
    if key in _HAS_CONTROL_DESCENDANT_CACHE:
        return _HAS_CONTROL_DESCENDANT_CACHE[key]
    result = any(is_control(child) or has_control_descendant(child) for child in node.children)
    _HAS_CONTROL_DESCENDANT_CACHE[key] = result
    return result


def direct_non_control_text(node: Node, limit: int = 120) -> str:
    own = direct_own_text(node, limit)
    if own:
        return own
    for child in node.children:
        if is_hidden(child) or has_control_descendant(child) or is_control(child):
            continue
        text = clean(child.text_content(), limit)
        if text and not looks_like_validation_label(text):
            return text
    return ""


def looks_like_validation_label(value: str) -> bool:
    text = clean(value, 120)
    if not text:
        return True
    return bool(re.fullmatch(r"(?:required|invalid|error|\*+|\u5fc5\u586b|\u672a\u586b\u5199|\u4e0d\u80fd\u4e3a\u7a7a|\u8bf7\u9009\u62e9|\u8bf7\u8f93\u5165|\u8bf7\u586b\u5199)", text, re.I))


def direct_label_candidate(node: Node) -> str:
    for attr in ("data-form-field-i18n-name", "data-form-field-title", "data-form-field-label", "aria-label"):
        text = normalize_label_text(node.attr(attr), 120)
        if text and not looks_like_validation_label(text):
            return text
    for child in node.children:
        if child.tag in LABEL_TAGS:
            text = normalize_label_text(child.text_content(), 120)
            if text and not looks_like_validation_label(text):
                return text
    for child in node.children:
        identity = f"{child.tag} {class_name(child)} {child.attr('role')}"
        if re.search(r"label|title|fieldName|heading", identity, re.I) and not has_control_descendant(child):
            text = normalize_label_text(child.text_content(), 120)
            if text and not looks_like_validation_label(text):
                return text
    return normalize_label_text(direct_non_control_text(node, 120), 120)


def labelled_control_child_count(node: Node) -> int:
    count = 0
    for child in node.children:
        if not has_control_descendant(child):
            continue
        if direct_label_candidate(child):
            count += 1
    return count


def has_descendant_explicit_field(node: Node) -> bool:
    key = id(node)
    if key in _HAS_DESCENDANT_EXPLICIT_FIELD_CACHE:
        return _HAS_DESCENDANT_EXPLICIT_FIELD_CACHE[key]
    result = any(is_explicit_field_container(child) or has_descendant_explicit_field(child) for child in node.children)
    _HAS_DESCENDANT_EXPLICIT_FIELD_CACHE[key] = result
    return result


def is_generic_field_container(node: Node) -> bool:
    if node.tag in {"document", "html", "body", "form", "fieldset", "section"}:
        return False
    if any(has_class_token(node, token) for token in MODULE_CONTAINER_TOKENS) or has_class_fragment(node, MODULE_CONTAINER_HINTS):
        return False
    if direct_module_title_text(node):
        return False
    if has_descendant_explicit_field(node):
        return False
    controls = control_descendants(node)
    if not controls or len(controls) > 24:
        return False
    if all(is_add_action_node(control) for control in controls):
        return False
    label = direct_label_candidate(node)
    if not label:
        return False
    if looks_like_module_title(label) and labelled_control_child_count(node) >= 1:
        return False
    if labelled_control_child_count(node) >= 2:
        return False
    return True


def is_field_container(node: Node) -> bool:
    return is_explicit_field_container(node) or is_generic_field_container(node)


def looks_like_navigation_title(value: str) -> bool:
    text = clean(value, 160)
    if not text:
        return False
    numbered_items = re.findall(r"(?:^|\s)\d+[.、]\s*[\u4e00-\u9fffA-Za-z]{2,16}", text)
    module_words = re.findall(
        r"基本信息|基础信息|个人信息|教育经历|教育背景|语言能力|自我评价|社交账号|上传简历|作品集|作品上传|项目经历|实习经历|工作经历|获奖信息|证书|附件",
        text,
    )
    return len(numbered_items) >= 3 or len(set(module_words)) >= 4


def looks_like_module_title(value: str) -> bool:
    if looks_like_navigation_title(value):
        return False
    text = normalize_module_title(value)
    return bool(text and len(text) <= 80 and MODULE_TITLE_PATTERN.search(text))


def looks_like_short_title(value: str) -> bool:
    text = normalize_module_title(value)
    if not text or looks_like_validation_label(text) or looks_like_navigation_title(text):
        return False
    if len(text) <= 32:
        return True
    return bool(len(text) <= 80 and MODULE_TITLE_PATTERN.search(text))


def title_node_text(node: Node) -> str:
    own = normalize_module_title(direct_own_text(node, 80))
    if looks_like_short_title(own):
        return own
    for child in node.children:
        if is_hidden(child) or is_control(child) or has_control_descendant(child):
            continue
        if has_class_fragment(child, TITLE_DESCRIPTION_HINTS):
            continue
        text = normalize_module_title(direct_own_text(child, 80))
        if looks_like_short_title(text):
            return text
        text = title_node_text(child)
        if looks_like_short_title(text):
            return text
    text = normalize_module_title(node.text_content())
    if " " in text:
        prefix = normalize_module_title(text.split(" ", 1)[0])
        if looks_like_short_title(prefix):
            return prefix
    return text if looks_like_short_title(text) else ""


def direct_module_title_text(node: Node) -> str:
    for child in node.children:
        if is_hidden(child) or is_control(child):
            continue
        if has_class_fragment(child, MODULE_TITLE_HINTS):
            text = title_node_text(child)
            if text:
                return text
        if has_control_descendant(child):
            for title_shell in child.children:
                if is_hidden(title_shell) or is_control(title_shell) or has_control_descendant(title_shell):
                    continue
                text = direct_child_text(title_shell, MODULE_TITLE_HINTS)
                if looks_like_module_title(text):
                    return normalize_module_title(text)
            continue
        text = direct_child_text(child, MODULE_TITLE_HINTS)
        if text and not has_explicit_module_marker(child) and looks_like_module_title(text):
            return normalize_module_title(text)
        if child.tag in HEADING_TAGS or child.attr("role").lower() == "heading":
            text = normalize_module_title(child.text_content())
            if looks_like_module_title(text):
                return text
    return ""


def direct_module_title_child_count(node: Node) -> int:
    count = 0
    for child in node.children:
        if is_hidden(child) or is_control(child) or has_control_descendant(child):
            continue
        text = direct_child_text(child, MODULE_TITLE_HINTS)
        if not text and (child.tag in HEADING_TAGS or child.attr("role").lower() == "heading"):
            text = child.text_content()
        if looks_like_module_title(text):
            count += 1
    return count


def direct_structured_module_child_count(node: Node) -> int:
    count = 0
    for child in node.children:
        if is_hidden(child) or is_control(child) or not has_control_descendant(child):
            continue
        title = direct_module_title_text(child)
        if looks_like_module_title(title):
            count += 1
    return count


def generic_module_title(node: Node) -> str:
    for attr in ("aria-label", "data-title", "title", "name"):
        text = normalize_module_title(node.attr(attr))
        if looks_like_module_title(text):
            return text
    text = direct_module_title_text(node)
    if text:
        return text
    for child in node.children:
        if child.tag in HEADING_TAGS or child.attr("role").lower() == "heading":
            text = normalize_module_title(child.text_content())
            if looks_like_module_title(text):
                return text
    for child in node.children:
        if is_hidden(child) or has_control_descendant(child) or is_control(child):
            continue
        text = normalize_module_title(child.text_content())
        if looks_like_module_title(text):
            return text
    return ""


def is_module_container(node: Node) -> bool:
    if node.tag in {"document", "html", "body"}:
        return False
    if is_field_container(node):
        return False
    explicit = has_explicit_module_marker(node)
    if explicit:
        return bool(module_node_title(node))
    title = generic_module_title(node)
    if not title or not has_control_descendant(node):
        return False
    if direct_module_title_child_count(node) >= 2:
        return False
    if direct_structured_module_child_count(node) >= 2:
        return False
    if node.tag in {"section", "fieldset", "form"}:
        return True
    return bool(direct_module_title_text(node)) and looks_like_module_title(title)


def normalize_module_title(value: str) -> str:
    text = clean(value, 120)
    text = re.sub(r"^\s*\d+[.、]\s*", "", text)
    text = re.sub(r"\s+(取消|保存|编辑|修改)$", "", text)
    for suffix in ("（必填）", "(必填)", "必填"):
        text = text.replace(suffix, "")
    return clean(text, 120)


def module_node_title(node: Node) -> str:
    return normalize_module_title(direct_module_title_text(node) or generic_module_title(node))


def direct_child_text(node: Node, fragments: tuple[str, ...]) -> str:
    if has_class_fragment(node, fragments):
        text = title_node_text(node) if fragments is MODULE_TITLE_HINTS else clean(node.text_content())
        if text:
            return text
    for child in node.children:
        if has_class_fragment(child, fragments):
            text = title_node_text(child) if fragments is MODULE_TITLE_HINTS else clean(child.text_content())
            if text:
                return text
        text = direct_child_text(child, fragments) if not is_field_container(child) else ""
        if text:
            return text
    return ""


def direct_child_attr(node: Node, fragments: tuple[str, ...], attr: str) -> str:
    for child in node.children:
        if has_class_fragment(child, fragments):
            value = child.attr(attr)
            if value:
                return value
        value = direct_child_attr(child, fragments, attr) if not is_field_container(child) else ""
        if value:
            return value
    return ""


def node_index(node: Node) -> int:
    if not node.parent:
        return 1
    same_tag = [child for child in node.parent.children if child.tag == node.tag]
    for index, child in enumerate(same_tag, start=1):
        if child is node:
            return index
    return 1


def css_path(node: Node, max_depth: int = 7) -> str:
    parts: list[str] = []
    current: Node | None = node
    depth = 0
    while current is not None and current.tag != "document" and depth < max_depth:
        part = current.tag
        if current.attr("id"):
            part += f"#{current.attr('id')}"
            parts.insert(0, part)
            break
        if current.attr("name"):
            part += f"[name={current.attr('name')}]"
        else:
            classes = class_name(current).split()[:2]
            if classes:
                part += "." + ".".join(classes)
        if current.parent:
            same_tag = [child for child in current.parent.children if child.tag == current.tag]
            if len(same_tag) > 1:
                part += f":nth-of-type({node_index(current)})"
        parts.insert(0, part)
        current = current.parent
        depth += 1
    return " > ".join(parts)


def is_hidden(node: Node) -> bool:
    style = node.attr("style").replace(" ", "").lower()
    return (
        node.attr("type").lower() == "hidden"
        or "display:none" in style
        or node.attr("aria-hidden").lower() == "true"
    )


def is_control(node: Node) -> bool:
    if is_hidden(node):
        return False
    if node.tag in CONTROL_TAGS:
        return True
    if node.attr("contenteditable").lower() == "true":
        return True
    role = node.attr("role").lower()
    if role in {"button", "textbox", "combobox", "radio", "checkbox", "switch"}:
        return True
    return has_class_fragment(node, CONTROL_CLASS_HINTS)


def compact_controls(nodes: list[Node]) -> list[Node]:
    compact: list[Node] = []
    for node in nodes:
        if any(any(ancestor is candidate for candidate in nodes) for ancestor in node.ancestors()):
            continue
        compact.append(node)
    return compact


def control_type(node: Node) -> str:
    classes = class_name(node)
    if node.tag == "textarea":
        return "textarea"
    if "atsx-upload" in classes:
        return "upload"
    if "ud__textarea" in classes:
        return "textarea"
    if "ud__picker" in classes:
        return "date"
    if node.tag == "select" or "phoenix-select" in classes or node.attr("role") == "combobox":
        return "select"
    if "ud__select" in classes:
        return "select"
    if "phoenix-button" in classes and any("phoenix-button__suffixIcon" in class_name(child) for child in node.walk()):
        return "select"
    if "phoenix-input" in classes or "ud__input" in classes or "ud__native-input" in classes:
        return "text"
    if node.tag == "input":
        return node.attr("type", "text") or "text"
    if node.attr("contenteditable").lower() == "true" or "edui-body-container" in classes:
        return "rich_text"
    if "file-uploader" in classes:
        return "upload"
    if "radio" in classes or "ud__radio" in classes or node.attr("role") == "radio":
        return "radio"
    if "checkbox" in classes or "ud__checkbox" in classes or node.attr("role") == "checkbox":
        return "checkbox"
    if node.tag == "button" or node.attr("role") == "button" or "button" in classes:
        return "button"
    return "custom"


def compound_control_semantic(field_label: str, kind: str, text: str) -> dict[str, str]:
    if kind != "select" or not text:
        return {}
    evidence = f"{field_label} {text}"
    if re.search("(?:identityDocumentNumber|\u8bc1\u4ef6\u53f7\u7801|\u8eab\u4efd\u8bc1\u53f7|document\\s*number|id\\s*number)", evidence, re.I) and re.search(
        "(?:\u8eab\u4efd\u8bc1|\u62a4\u7167|\u901a\u884c\u8bc1|\u519b\u4eba\u8bc1|\u8b66\u5b98\u8bc1|passport|id)",
        text,
        re.I,
    ):
        return {
            "semantic_key": "identityDocumentType",
            "semantic_label": "\u8bc1\u4ef6\u7c7b\u578b",
            "compound_role": "identity-document-type",
            "sub_control_of": field_label,
        }
    if re.search("(?:phone|mobile|telephone|\u624b\u673a|\u7535\u8bdd)", evidence, re.I) and re.search(
        "(?:\u4e2d\u56fd\u5927\u9646|\u4e2d\u56fd\u6e2f\u6fb3\u53f0|\u56fd\u5916|\u5927\u9646|\u6e2f\u6fb3\u53f0|\u6d77\u5916|\u5883\u5916)",
        text,
        re.I,
    ):
        return {
            "semantic_key": "phoneCountryRegion",
            "semantic_label": "\u624b\u673a\u53f7\u7801\u5730\u533a",
            "compound_role": "phone-country-region",
            "sub_control_of": field_label,
        }
    return {}


def control_summary(node: Node, index: int, field_label: str = "") -> dict[str, Any]:
    text = clean(
        node.attr("aria-label")
        or node.attr("title")
        or node.attr("placeholder")
        or node.attr("value")
        or node.text_content(),
        limit=120,
    )
    kind = control_type(node)
    item = {
        "index": index,
        "type": kind,
        "tag": node.tag,
        "text": text,
        "name": node.attr("name"),
        "id": node.attr("id"),
        "class": class_name(node),
        "path": css_path(node),
    }
    item.update(compound_control_semantic(field_label, kind, text))
    return item


def nearest_field_container(node: Node) -> Node | None:
    for ancestor in node.ancestors():
        if is_field_container(ancestor):
            return ancestor
    return None


def field_label(field: Node) -> tuple[str, str]:
    for attr in ("data-form-field-i18n-name", "data-form-field-title", "data-form-field-label"):
        text = normalize_label_text(field.attr(attr), 120)
        if text:
            return text, attr
    text = normalize_label_text(direct_child_text(field, FIELD_LABEL_HINTS), 120)
    if text:
        return text, "field-title"
    text = direct_label_candidate(field)
    if text:
        return text, "direct-label"
    for child in field.walk():
        if child.tag == "label":
            text = normalize_label_text(child.text_content())
            if text:
                return text, "label"
    return "", "unknown"


def is_record_card(node: Node) -> bool:
    return any(re.match(r"^apply-form-array-card(?:__|$)", token) for token in class_name(node).split())


def nearest_record_card(node: Node) -> Node | None:
    for ancestor in node.ancestors():
        if is_record_card(ancestor):
            return ancestor
    return None


def record_card_info(field: Node) -> dict[str, Any]:
    card = nearest_record_card(field)
    if card is not None and card.parent is not None:
        siblings = [child for child in card.parent.children if is_record_card(child)]
        index = next((candidate_index for candidate_index, sibling in enumerate(siblings, start=1) if sibling is card), 0)
        if index and len(siblings) > 1:
            return {
                "record_index": index,
                "record_total": len(siblings),
                "record_path": css_path(card),
            }
    return generic_record_info(field)


def normalized_signature_label(value: str) -> str:
    text = clean(value, 80).lower()
    text = re.sub(r"[\s:：*＊()（）\[\]【】]+", "", text)
    text = re.sub(r"\d+$", "", text)
    return text


def field_nodes_in(node: Node) -> list[Node]:
    selected: list[Node] = []
    for child in node.walk():
        if child is node or not is_field_container(child):
            continue
        if not control_descendants(child):
            continue
        if any(any(ancestor is selected_node for selected_node in selected) for ancestor in child.ancestors()):
            continue
        selected.append(child)
    return selected


def field_signature(node: Node) -> list[str]:
    labels: list[str] = []
    if is_field_container(node):
        label, _ = field_label(node)
        normalized = normalized_signature_label(label)
        if normalized:
            labels.append(normalized)
    for field in field_nodes_in(node):
        label, _ = field_label(field)
        normalized = normalized_signature_label(label)
        if normalized:
            labels.append(normalized)
    return labels


def signature_similarity(left: list[str], right: list[str]) -> float:
    left_set = set(left)
    right_set = set(right)
    if not left_set or not right_set:
        return 0.0
    overlap = len(left_set & right_set)
    return overlap / max(len(left_set), len(right_set))


def generic_record_info(field: Node) -> dict[str, Any]:
    for ancestor in field.ancestors():
        if ancestor.parent is None:
            continue
        if is_module_container(ancestor):
            break
        signature = field_signature(ancestor)
        if not signature:
            continue
        siblings: list[Node] = []
        for sibling in ancestor.parent.children:
            if not has_control_descendant(sibling):
                continue
            sibling_signature = field_signature(sibling)
            if signature_similarity(signature, sibling_signature) >= 0.5:
                siblings.append(sibling)
        if len(siblings) < 2 or not any(sibling is ancestor for sibling in siblings):
            continue
        index = next((candidate_index for candidate_index, sibling in enumerate(siblings, start=1) if sibling is ancestor), 0)
        return {
            "record_index": index,
            "record_total": len(siblings),
            "record_path": css_path(ancestor),
        }
    return {"record_index": 0, "record_total": 0, "record_path": ""}


def sibling_texts(node: Node) -> dict[str, str]:
    if not node.parent:
        return {"previous": "", "next": ""}
    siblings = node.parent.children
    index = next((candidate_index for candidate_index, sibling in enumerate(siblings) if sibling is node), 0)
    previous_text = clean(" ".join(sibling.text_content() for sibling in siblings[max(0, index - 2):index]), 160)
    next_text = clean(" ".join(sibling.text_content() for sibling in siblings[index + 1:index + 3]), 160)
    return {"previous": previous_text, "next": next_text}


def module_title(field: Node) -> str:
    current: Node | None = field.parent
    while current is not None:
        if is_module_container(current):
            title = module_node_title(current)
            if title:
                return title
        text = direct_child_text(current, MODULE_TITLE_HINTS)
        if text:
            return normalize_module_title(text)
        current = current.parent
    return ""


def is_add_action_node(node: Node) -> bool:
    text = clean(node.text_content(), 80)
    identity = f"{node.attr('id')} {class_name(node)}"
    if "add" in identity.lower():
        return any(fragment in identity for fragment in ADD_ACTION_HINTS)
    if "添加" not in text and "add" not in text.lower():
        return False
    return has_class_fragment(node, ADD_ACTION_HINTS) or any(fragment in identity for fragment in ADD_ACTION_HINTS)


def add_action_texts(module: Node, module_title_text: str) -> list[str]:
    selected: list[Node] = []
    for node in module.walk():
        if node is module or not is_add_action_node(node):
            continue
        if any(any(ancestor is selected_node for selected_node in selected) for ancestor in node.ancestors()):
            continue
        selected.append(node)

    results: list[str] = []
    for node in selected:
        text = clean(node.text_content(), 80)
        if text == "添加" and module_title_text:
            text = f"添加{module_title_text}"
        if text and text not in results:
            results.append(text)
    return results


def global_add_actions_by_module_id(root: Node) -> dict[str, list[str]]:
    actions: dict[str, list[str]] = {}
    for node in root.walk():
        node_id = node.attr("id")
        if not node_id.endswith("_addButton") or not is_add_action_node(node):
            continue
        module_id = node_id[: -len("_addButton")]
        text = clean(node.text_content(), 80)
        if text and text not in actions.setdefault(module_id, []):
            actions[module_id].append(text)
    return actions


def parse_modules(root: Node) -> list[dict[str, Any]]:
    clear_static_caches()
    module_nodes: list[Node] = []
    global_add_actions = global_add_actions_by_module_id(root)
    for node in root.walk():
        if not is_module_container(node):
            continue
        if any(any(ancestor is module_node for module_node in module_nodes) for ancestor in node.ancestors()):
            continue
        module_nodes.append(node)

    modules: list[dict[str, Any]] = []
    for index, module in enumerate(module_nodes, start=1):
        title = module_node_title(module)
        add_actions = add_action_texts(module, title)
        title_id = direct_child_attr(module, MODULE_TITLE_HINTS, "id")
        for text in global_add_actions.get(title_id, []):
            if text not in add_actions:
                add_actions.append(text)
        modules.append(
            {
                "module_index": index,
                "module": title,
                "add_actions": add_actions,
                "module_container": {
                    "tag": module.tag,
                    "class": class_name(module),
                    "path": css_path(module),
                },
            }
        )
    return modules


def sub_control_roles(label: str, controls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not controls:
        return []
    date_parts = ["year", "month", "year", "month"]
    control_texts = [clean(control.get("text", ""), 20) for control in controls[:4]]
    has_year = any(text in {"年", "YYYY", "yyyy", "year"} for text in control_texts)
    has_month = any(text in {"月", "MM", "mm", "month"} for text in control_texts)
    has_year_month_pair = has_year and has_month
    if has_year_month_pair and len(controls) >= 4 and DATE_RANGE_PATTERN.search(label):
        roles = ["start_year", "start_month", "end_year", "end_month"]
        return [
            {
                **control,
                "date_part": date_parts[index] if index < len(date_parts) else "",
                "range_role": roles[index] if index < len(roles) else "",
            }
            for index, control in enumerate(controls)
        ]
    if has_year_month_pair and len(controls) >= 2 and DATE_FIELD_PATTERN.search(label):
        return [
            {**control, "date_part": date_parts[index] if index < len(date_parts) else ""}
            for index, control in enumerate(controls)
        ]
    return controls


def sub_control_roles_v2(label: str, controls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not controls:
        return []
    date_parts = ["year", "month", "year", "month"]
    control_texts = [clean(control.get("text", ""), 20) for control in controls[:4]]
    has_year = any(text in {"\u5e74", "YYYY", "yyyy", "year"} for text in control_texts)
    has_month = any(text in {"\u6708", "MM", "mm", "month"} for text in control_texts)
    if not (has_year and has_month):
        return controls
    if len(controls) >= 4 and DATE_RANGE_PATTERN.search(label):
        roles = ["start_year", "start_month", "end_year", "end_month"]
        return [
            {
                **control,
                "date_part": date_parts[index] if index < len(date_parts) else "",
                "range_role": roles[index] if index < len(roles) else "",
            }
            for index, control in enumerate(controls)
        ]
    if len(controls) >= 2 and DATE_FIELD_PATTERN.search(label):
        return [
            {**control, "date_part": date_parts[index] if index < len(date_parts) else ""}
            for index, control in enumerate(controls)
        ]
    return controls


def parse_fields(root: Node) -> list[dict[str, Any]]:
    clear_static_caches()
    field_nodes: list[Node] = []
    seen: set[int] = set()
    for node in root.walk():
        if not is_field_container(node):
            continue
        if any(id(ancestor) in seen for ancestor in node.ancestors()):
            continue
        controls = control_descendants(node)
        if not controls:
            continue
        if all(is_add_action_node(control) for control in controls):
            continue
        identity = id(node)
        if identity not in seen:
            seen.add(identity)
            field_nodes.append(node)

    fields: list[dict[str, Any]] = []
    for index, field in enumerate(field_nodes, start=1):
        label, label_source = field_label(field)
        control_nodes = compact_controls([child for child in field.walk() if child is not field and is_control(child)])
        controls = [control_summary(control, control_index, label) for control_index, control in enumerate(control_nodes, start=1)]
        fields.append(
            {
                "field_index": index,
                "module": module_title(field),
                "label": label,
                "label_source": label_source,
                **record_card_info(field),
                "control_count": len(controls),
                "controls": sub_control_roles_v2(label, controls),
                "field_container": {
                    "tag": field.tag,
                    "class": class_name(field),
                    "path": css_path(field),
                    "parent": {
                        "tag": field.parent.tag if field.parent else "",
                        "class": class_name(field.parent) if field.parent else "",
                        "path": css_path(field.parent) if field.parent else "",
                    },
                    "siblings": sibling_texts(field),
                },
            }
        )
    return fields


def simplify_fields(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    totals: dict[tuple[str, str], int] = {}
    seen: dict[tuple[str, str], int] = {}
    for field in fields:
        key = (field["module"], field["label"])
        totals[key] = totals.get(key, 0) + 1

    simple_fields: list[dict[str, Any]] = []
    for field in fields:
        key = (field["module"], field["label"])
        seen[key] = seen.get(key, 0) + 1
        total = totals[key]
        item = {
            "field_index": field["field_index"],
            "module": field["module"],
            "label": field["label"],
            "control_count": field["control_count"],
            "record_index": field.get("record_index", 0),
            "record_total": field.get("record_total", 0),
            "repeat_index": seen[key],
            "repeat_total": total,
        }
        if total > 1:
            item["label_with_index"] = f"{field['label']}{seen[key]}"
        simple_fields.append(item)
    return simple_fields


def module_summary(fields: list[dict[str, Any]], module_infos: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    summaries: dict[str, dict[str, Any]] = {}
    for module_info in module_infos or []:
        module = module_info["module"] or "未命名模块"
        if module not in summaries:
            summaries[module] = {
                "module": module,
                "field_count": 0,
                "record_count": 0,
                "labels": {},
                "add_actions": module_info.get("add_actions", []),
                "module_container": module_info.get("module_container", {}),
            }
    for field in fields:
        module = field["module"] or "未命名模块"
        label = field["label"] or "未命名字段"
        if module not in summaries:
            summaries[module] = {
                "module": module,
                "field_count": 0,
                "record_count": 0,
                "record_total": 0,
                "labels": {},
                "add_actions": [],
                "module_container": {},
            }
        summary = summaries[module]
        summary["field_count"] += 1
        summary["record_total"] = max(summary.get("record_total", 0), int(field.get("record_total") or 0))
        summary["labels"][label] = summary["labels"].get(label, 0) + 1

    results: list[dict[str, Any]] = []
    for summary in summaries.values():
        label_counts = [
            {"label": label, "count": count}
            for label, count in summary["labels"].items()
        ]
        record_count = summary.get("record_total", 0) or max((item["count"] for item in label_counts), default=0)
        repeated_labels = [item for item in label_counts if item["count"] > 1]
        results.append(
            {
                "module": summary["module"],
                "field_count": summary["field_count"],
                "record_count": record_count,
                "repeated_label_count": len(repeated_labels),
                "labels": label_counts,
                "repeated_labels": repeated_labels,
                "add_action_count": len(summary.get("add_actions", [])),
                "add_actions": summary.get("add_actions", []),
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a static field-location report from an HTML file.")
    parser.add_argument("html", type=Path)
    parser.add_argument("--module", default="", help="Only include fields whose module contains this text.")
    parser.add_argument("--contains", default="", help="Only print fields whose JSON contains this text.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--simple", action="store_true", help="Only include field_index, module, label, and control_count.")
    parser.add_argument("--out", type=Path, help="Write JSON report to this file instead of stdout.")
    args = parser.parse_args()

    root = parse_dom(args.html.read_text(encoding="utf-8", errors="replace"))
    all_modules = parse_modules(root)
    all_fields = parse_fields(root)
    fields = all_fields
    summary_modules = all_modules
    if args.module:
        fields = [field for field in fields if args.module in field["module"]]
        summary_modules = [module for module in summary_modules if args.module in module["module"]]
    if args.contains:
        fields = [field for field in fields if args.contains in json.dumps(field, ensure_ascii=False)]
        summary_modules = [
            module for module in summary_modules
            if args.contains in json.dumps(module, ensure_ascii=False)
        ]
    if args.limit:
        fields = fields[: args.limit]
    modules = module_summary(fields, summary_modules)
    if args.simple:
        fields = simplify_fields(fields)
    total_modules = module_summary(all_fields, all_modules)
    report = {
        "source": str(args.html),
        "total_field_count": len(all_fields),
        "field_count": len(fields),
        "total_module_count": len(total_modules),
        "module_count": len(modules),
        "modules": modules,
        "fields": fields,
    }
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(str(args.out))
        return
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

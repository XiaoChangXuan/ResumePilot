from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from .html_dom import Node


CONTROL_TAGS = {"input", "textarea", "select", "button"}
INTERACTIVE_TAGS = CONTROL_TAGS | {"a", "details", "summary", "option"}
INTERACTIVE_ROLES = {
    "button",
    "link",
    "menuitem",
    "option",
    "radio",
    "checkbox",
    "switch",
    "tab",
    "textbox",
    "combobox",
    "slider",
    "spinbutton",
    "searchbox",
}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "legend"}
SKIP_TAGS = {"script", "style", "noscript", "template", "meta", "link"}
SKIP_IDENTITY_RE = re.compile(r"(?:resume-page-audit|__resumePageAudit|resume-audit|aminer-ai-extension-root|extension-root|chrome-extension)", re.I)
FIELD_CLASS_RE = re.compile(
    r"(?:form[-_]?item|field|input[_-]?box|info[_-]?box|ant-form-item|el-form-item|"
    r"ud-formily-item|rocket-form-field|apply-field)",
    re.I,
)
CONTROL_CLASS_RE = re.compile(
    r"(?:^|[\s_-])(?:input|select|radio|checkbox|textarea|upload|picker|cascader|date|datepicker|"
    r"button|btn|combobox|switch|slider)(?:$|[\s_-])|"
    r"(?:phoenix|el|ant|atsx|ud)(?:__|-)[\w-]*(?:input|select|radio|checkbox|textarea|upload|picker|"
    r"cascader|date|button|btn|combobox|switch|slider)",
    re.I,
)
ACTION_CLASS_RE = re.compile(
    r"(?:add[-_]?btn|addmore|remove[-_]?btn|delete[-_]?btn|edit[-_]?btn|save[-_]?btn|"
    r"cancel[-_]?btn|operate|action|btn)",
    re.I,
)
ACTION_TEXT_RE = re.compile(
    r"^(?:\+|\u6dfb\u52a0|\u65b0\u589e|\u5220\u9664|\u7f16\u8f91|\u4fdd\u5b58|\u53d6\u6d88|\u4fee\u6539)$",
    re.I,
)
ACTION_WORD_RE = re.compile(r"(?:\u6dfb\u52a0|\u65b0\u589e|\u5220\u9664|\u7f16\u8f91|\u4fdd\u5b58|\u53d6\u6d88|\u4fee\u6539)", re.I)
TITLE_CLASS_RE = re.compile(
    r"(?:title|heading|legend|label|send_title|section-title|module-title|blockTitle|divider-title)",
    re.I,
)
TITLE_DESCRIPTION_RE = re.compile(r"(?:title_text|describe|description|help|tip|remark|note|unloadTip)", re.I)
MODULE_CONTAINER_RE = re.compile(
    r"(?:section|module|block|panel|card|send_box|createFormSection|applyFormModuleWrapper|"
    r"cv-module|apply-block)",
    re.I,
)
MODULE_WORD_RE = re.compile(
    r"(?:"
    r"\u4e0a\u4f20|\u7b80\u5386|\u4e2a\u4eba|\u57fa\u672c|\u57fa\u7840|\u8054\u7cfb|\u6c42\u804c|\u5185\u63a8|\u610f\u5411|"
    r"\u6559\u80b2|\u5b66\u5386|\u5b66\u4e60|\u5c31\u8bfb|\u6821\u56ed|\u5b9e\u4e60|\u5de5\u4f5c|"
    r"\u9879\u76ee|\u7ecf\u5386|\u7ecf\u9a8c|\u5b9e\u8df5|\u8bed\u8a00|\u5916\u8bed|\u82f1\u8bed|\u6280\u80fd|"
    r"\u8bc1\u4e66|\u83b7\u5956|\u8363\u8a89|\u9644\u4ef6|\u9644\u52a0|\u8865\u5145|\u5174\u8da3|\u7231\u597d|\u7ec4\u7ec7|\u4f5c\u54c1|\u5bb6\u5ead|\u81ea\u6211|"
    r"\u8bc4\u4ef7|\u793e\u4ea4|\u8d26\u53f7|\u8d44\u6599|\u8bc1\u660e|\u5173\u952e|\u5176\u4ed6|"
    r"basic|personal|contact|education|academic|school|work|job|intern|project|"
    r"experience|language|skill|certificate|award|honou?r|attachment|additional|profile|resume"
    r")",
    re.I,
)
ZONE_RE = {
    "overlay": re.compile(r"(?:modal|dialog|popup|popover|tooltip|dropdown|overlay|cascader|picker|popper|select[-_]?menu|select[-_]?dropdown)", re.I),
    "nav": re.compile(r"(?:\bnav\b|nav[-_]|navbar|nav-bar|\bmenu\b|menu[-_]|\btabs?\b|tabs?[-_]|\bsteps?\b|steps?[-_]|breadcrumb)", re.I),
    "sidebar": re.compile(r"(?:sidebar|aside|sider|drawer|side[-_]?(?:bar|nav|menu))", re.I),
    "header": re.compile(r"(?:header|top|masthead)", re.I),
    "main": re.compile(r"(?:main|content|container|page|form|resume|apply|delivery)", re.I),
}
FIELD_COMPONENT_RE = re.compile(
    r"(?:form[-_]?item|field|input[_-]?box|info[_-]?box|ant-form-item|el-form-item|"
    r"ud-formily-item|rocket-form-field|apply-field|apply-fields|input|select|textarea|"
    r"picker|cascader|upload)",
    re.I,
)
FORM_PAGE_RE = re.compile(
    r"(?:resumeEditForm|saasResumeEditForm|resumeFormPage|apply-form|complete-form|atsx-form|"
    r"form-root|wrapper-editor|STFormContainer|apply-block|job-form)",
    re.I,
)
STRUCTURAL_ZONES = {"head", "header", "nav", "sidebar", "footer"}
ZONE_TITLES = {
    "head": "\u6587\u6863 head",
    "header": "\u9875\u5934",
    "nav": "\u5bfc\u822a\u680f",
    "sidebar": "\u4fa7\u8fb9\u680f",
    "footer": "\u9875\u811a",
    "overlay": "\u6d6e\u5c42",
}
EMPTY_STATE_TITLE_RE = re.compile(r"^(?:\u65e0|\u6ca1\u6709|\u6682\u65e0).{0,24}(?:\u7ecf\u5386|\u7ecf\u9a8c|\u4fe1\u606f|\u5185\u5bb9)$")


def clean(value: str, limit: int = 240) -> str:
    text = " ".join(str(value or "").replace("\xa0", " ").split())
    return text.strip(" :\uff1a*")[:limit]


def class_name(node: Node) -> str:
    return node.attr("class")


def identity_text(node: Node) -> str:
    return " ".join(
        part
        for part in (
            node.tag,
            node.attr("id"),
            node.attr("class"),
            node.attr("role"),
            node.attr("name"),
            node.attr("data-testid"),
            node.attr("data-test"),
        )
        if part
    )


def is_hidden_node(node: Node) -> bool:
    style = node.attr("style").replace(" ", "").lower()
    return (
        node.tag in SKIP_TAGS
        or SKIP_IDENTITY_RE.search(identity_text(node)) is not None
        or node.attr("hidden") != ""
        or node.attr("type").lower() == "hidden"
        or node.attr("aria-hidden").lower() == "true"
        or "display:none" in style
        or "visibility:hidden" in style
    )


def is_control_node(node: Node) -> bool:
    if is_hidden_node(node):
        return False
    if node.tag in CONTROL_TAGS:
        return True
    if node.attr("contenteditable").lower() == "true":
        return True
    role = node.attr("role").lower()
    if role in {"textbox", "combobox", "radio", "checkbox", "switch", "slider", "spinbutton"}:
        return True
    return bool(CONTROL_CLASS_RE.search(identity_text(node)))


def is_interactive_node(node: Node) -> bool:
    if is_control_node(node):
        return True
    if is_hidden_node(node):
        return False
    if node.tag in INTERACTIVE_TAGS:
        return True
    if node.attr("onclick") or node.attr("tabindex"):
        return True
    role = node.attr("role").lower()
    if role in INTERACTIVE_ROLES:
        return True
    if ACTION_CLASS_RE.search(identity_text(node)) and ACTION_WORD_RE.search(clean(node.text_content(), 40)):
        return True
    return False


def looks_like_footer_node(node: Node, identity: str | None = None) -> bool:
    identity = identity if identity is not None else identity_text(node)
    text = clean(node.text_content(), 500)
    legal_re = re.compile(
        r"(?:copyright|copy[-_ ]?right|beian|icp|legal|polic(?:y|ies)|privacy|terms|"
        r"\u7248\u6743\u6240\u6709|\u5907\u6848|\u516c\u7f51\u5b89\u5907|\u9690\u79c1\u653f\u7b56|\u7528\u6237\u534f\u8bae|©)",
        re.I,
    )
    if legal_re.search(identity):
        return True
    if not re.search(r"(?:^|[\s_-])(?:footer|site-footer|page-footer|global-footer)(?:$|[\s_-])", identity, re.I):
        return False
    stack = list(node.children)
    button_texts: list[str] = []
    while stack:
        child = stack.pop()
        if child.tag in {"input", "textarea", "select"}:
            return False
        role = child.attr("role").lower()
        if child.attr("contenteditable").lower() == "true" or role in {"textbox", "combobox"}:
            return False
        if child.tag == "button" or role == "button":
            button_texts.append(child.text_content())
        stack.extend(child.children)
    return bool(legal_re.search(text)) or not re.search(
        r"(?:\u63d0\u4ea4|\u4fdd\u5b58|\u6682\u5b58|\u53d6\u6d88|\u9884\u89c8|\u4e0b\u4e00\u6b65|\u4e0a\u4e00\u6b65|submit|save|cancel|preview|next|back)",
        clean(" ".join(button_texts), 240),
        re.I,
    )


def stable_classes(node: Node, limit: int = 4) -> list[str]:
    result: list[str] = []
    for token in class_name(node).split():
        lowered = token.lower()
        if any(part in lowered for part in ("active", "focus", "hover", "selected", "disabled", "open", "close")):
            continue
        result.append(token)
        if len(result) >= limit:
            break
    return result


def node_index(node: Node) -> int:
    if not node.parent:
        return 1
    siblings = [child for child in node.parent.children if child.tag == node.tag]
    for index, sibling in enumerate(siblings, start=1):
        if sibling is node:
            return index
    return 1


def css_path(node: Node, max_depth: int = 8) -> str:
    parts: list[str] = []
    current: Node | None = node
    depth = 0
    while current is not None and current.tag != "document" and depth < max_depth:
        part = current.tag
        if current.attr("id"):
            part += f"#{current.attr('id')}"
            parts.insert(0, part)
            break
        classes = stable_classes(current, 2)
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


def own_text(node: Node, limit: int = 120) -> str:
    return clean(" ".join(node.text_parts), limit)


def looks_like_navigation_text(text: str) -> bool:
    value = clean(text, 240)
    if not value:
        return False
    numbered = re.findall(r"(?:^|\s)\d+[.\u3001]?\s*[\u4e00-\u9fffA-Za-z]{2,16}", value)
    words = MODULE_WORD_RE.findall(value)
    return len(numbered) >= 4 or len(set(words)) >= 5


def normalize_title(text: str) -> str:
    value = clean(text, 120)
    value = re.sub(r"^\s*\d+[.\u3001]?\s*", "", value)
    value = re.sub(r"\s+(?:\u6dfb\u52a0|\u53d6\u6d88|\u4fdd\u5b58|\u7f16\u8f91|\u4fee\u6539|\u5220\u9664)$", "", value)
    value = value.replace("\uff08\u5fc5\u586b\uff09", "").replace("(\u5fc5\u586b)", "").replace("\u5fc5\u586b", "")
    return clean(value, 120)


def looks_like_module_title(text: str) -> bool:
    value = normalize_title(text)
    if not value or len(value) > 80 or looks_like_navigation_text(value):
        return False
    if EMPTY_STATE_TITLE_RE.match(value):
        return False
    return bool(MODULE_WORD_RE.search(value))


def looks_like_short_title(text: str) -> bool:
    value = normalize_title(text)
    if not value or looks_like_navigation_text(value):
        return False
    if EMPTY_STATE_TITLE_RE.match(value):
        return False
    if re.fullmatch(r"(?:required|invalid|error|\*+|\u5fc5\u586b|\u672a\u586b\u5199|\u8bf7\u9009\u62e9|\u8bf7\u8f93\u5165)", value, re.I):
        return False
    return len(value) <= 32


def title_text_from_title_node(item: "SemanticNode") -> str:
    direct = normalize_title(item.own_text)
    if looks_like_short_title(direct):
        return direct
    for child in item.children:
        if child.is_hidden or child.is_control or TITLE_DESCRIPTION_RE.search(identity_text(child.node)):
            continue
        text = normalize_title(child.own_text)
        if looks_like_short_title(text):
            return text
        text = title_text_from_title_node(child)
        if looks_like_short_title(text):
            return text
    text = normalize_title(item.text)
    if looks_like_short_title(text):
        return text
    return text if looks_like_module_title(text) else ""


@dataclass(slots=True)
class SemanticNode:
    node: Node
    parent: "SemanticNode | None"
    children: list["SemanticNode"] = field(default_factory=list)
    depth: int = 0
    order: int = 0
    index: int = 1
    path: str = ""
    zone: str = "body"
    own_text: str = ""
    text: str = ""
    title: str = ""
    is_hidden: bool = False
    is_control: bool = False
    is_interactive: bool = False
    is_heading: bool = False
    is_field_like: bool = False
    is_title_like: bool = False
    is_module_shell_like: bool = False
    text_len: int = 0
    control_count: int = 0
    interactive_count: int = 0
    field_like_count: int = 0
    title_like_count: int = 0
    module_shell_count: int = 0

    @property
    def tag(self) -> str:
        return self.node.tag

    @property
    def class_name(self) -> str:
        return self.node.attr("class")

    def ancestors(self) -> Iterable["SemanticNode"]:
        current = self.parent
        while current is not None:
            yield current
            current = current.parent

    def to_summary(self) -> dict[str, Any]:
        return {
            "tag": self.tag,
            "path": self.path,
            "zone": self.zone,
            "id": self.node.attr("id"),
            "class": self.class_name,
            "text": clean(self.text, 160),
            "title": self.title,
            **counts_field(
                control_count=self.control_count,
                interactive_count=self.interactive_count,
                field_like_count=self.field_like_count,
                title_like_count=self.title_like_count,
            ),
        }


@dataclass(slots=True)
class SemanticTree:
    root: SemanticNode
    by_node_id: dict[int, SemanticNode]

    def get(self, node: Node) -> SemanticNode | None:
        return self.by_node_id.get(id(node))

    def walk(self) -> Iterable[SemanticNode]:
        def visit(item: SemanticNode) -> Iterable[SemanticNode]:
            yield item
            for child in item.children:
                yield from visit(child)

        yield from visit(self.root)


def explicit_zone(node: Node) -> str:
    if node.tag == "head":
        return "head"
    if node.tag == "header":
        return "header"
    if node.tag == "nav":
        return "nav"
    if node.tag == "aside":
        return "sidebar"
    if node.tag == "main":
        return "main"
    if node.tag == "footer":
        return "footer"
    if node.tag in {"dialog"} or node.attr("role").lower() in {"dialog", "alertdialog", "tooltip", "menu", "listbox"}:
        return "overlay"
    identity = identity_text(node)
    if looks_like_footer_node(node, identity):
        return "footer"
    for zone, pattern in ZONE_RE.items():
        if pattern.search(identity):
            return zone
    return ""


def strong_landmark_zone(node: Node, zone: str) -> bool:
    role = node.attr("role").lower()
    identity = identity_text(node)
    if zone == "head":
        return node.tag == "head"
    if zone == "header":
        return (
            node.tag == "header"
            or role == "banner"
            or re.search(
                r"(?:^|[\s_-])(?:topbar|top-bar|masthead|nav-header|global[-_\s]?header|site[-_\s]?header|page[-_\s]?header|app[-_\s]?header)(?:$|[\s_-])",
                identity,
                re.I,
            )
            is not None
        )
    if zone == "nav":
        return node.tag == "nav" or role == "navigation"
    if zone == "sidebar":
        return node.tag == "aside" or role == "complementary"
    if zone == "main":
        return node.tag == "main" or role == "main"
    if zone == "footer":
        return node.tag == "footer" or role == "contentinfo"
    if zone == "overlay":
        return node.tag == "dialog" or role in {"dialog", "alertdialog"}
    return False


def inside_field_component(node: Node) -> bool:
    current = node.parent
    while current is not None:
        identity = identity_text(current)
        if FIELD_COMPONENT_RE.search(identity):
            return True
        if (
            current.tag in {"body", "main", "section", "fieldset", "form"}
            or MODULE_CONTAINER_RE.search(identity)
            or re.search(r"(?:resumeEditForm|apply-form)", identity, re.I)
        ):
            return False
        current = current.parent
    return False


def inside_form_page(node: Node) -> bool:
    current: Node | None = node
    while current is not None:
        if FORM_PAGE_RE.search(identity_text(current)):
            return True
        if current.tag in {"body", "header", "nav", "footer"}:
            return False
        current = current.parent
    return False


def has_editable_descendant(node: Node) -> bool:
    for child in node.walk():
        if child is node:
            continue
        role = child.attr("role").lower()
        if child.tag in CONTROL_TAGS or child.attr("contenteditable").lower() == "true" or role in {"textbox", "combobox"}:
            return True
    return False


def should_apply_explicit_zone(node: Node, zone: str, inherited_zone: str) -> bool:
    if not zone:
        return False
    if zone in {"head", "main", "overlay"}:
        return True
    if strong_landmark_zone(node, zone):
        return True
    if zone in {"header", "nav", "sidebar", "footer"} and inside_field_component(node):
        return False
    if zone == "header" and inside_form_page(node):
        return False
    if zone == "header" and inherited_zone == "main":
        return False
    return True


def title_from_node(item: SemanticNode) -> str:
    node = item.node
    for attr in ("aria-label", "data-title", "title", "name"):
        text = normalize_title(node.attr(attr))
        if looks_like_module_title(text):
            return text
    direct = normalize_title(item.own_text)
    if looks_like_module_title(direct):
        return direct
    if item.is_heading:
        text = title_text_from_title_node(item)
        if looks_like_module_title(text):
            return text
    for child in item.children:
        if child.is_hidden:
            continue
        if child.is_heading or TITLE_CLASS_RE.search(identity_text(child.node)):
            text = title_text_from_title_node(child)
            if looks_like_short_title(text) or looks_like_module_title(text):
                return text
            nested = title_from_node(child)
            if nested:
                return nested
        if child.control_count:
            continue
    return ""


def build_semantic_tree(root: Node) -> SemanticTree:
    by_node_id: dict[int, SemanticNode] = {}
    next_order = 0

    def build(node: Node, parent: SemanticNode | None, depth: int, inherited_zone: str) -> SemanticNode:
        nonlocal next_order
        next_order += 1
        explicit = explicit_zone(node)
        zone = explicit if should_apply_explicit_zone(node, explicit, inherited_zone) else inherited_zone
        item = SemanticNode(
            node=node,
            parent=parent,
            depth=depth,
            order=next_order,
            index=node_index(node),
            path=css_path(node),
            zone=zone or "body",
            own_text=own_text(node),
            is_hidden=is_hidden_node(node) or bool(parent and parent.is_hidden),
            is_control=is_control_node(node),
            is_interactive=is_interactive_node(node),
            is_heading=node.tag in HEADING_TAGS or node.attr("role").lower() == "heading",
        )
        by_node_id[id(node)] = item
        for child in node.children:
            item.children.append(build(child, item, depth + 1, item.zone))

        child_texts = [child.text for child in item.children if child.text]
        item.text = clean(" ".join([item.own_text, *child_texts]), 500)
        item.text_len = len(item.text)
        item.is_title_like = (
            not item.is_hidden
            and not item.is_control
            and not any(child.is_control for child in item.children)
            and (item.is_heading or TITLE_CLASS_RE.search(identity_text(node)) is not None)
            and looks_like_module_title(item.own_text or item.text)
        )
        item.is_field_like = (
            not item.is_hidden
            and not item.is_control
            and (
                bool(FIELD_CLASS_RE.search(identity_text(node)))
                or bool(node.attr("data-form-field-name"))
                or bool(node.attr("data-form-field-i18n-name"))
            )
        )
        item.is_module_shell_like = (
            not item.is_hidden
            and not item.is_control
            and (
                node.tag in {"section", "fieldset", "form"}
                or bool(MODULE_CONTAINER_RE.search(identity_text(node)))
            )
        )
        item.control_count = int(item.is_control) + sum(child.control_count for child in item.children)
        item.interactive_count = int(item.is_interactive) + sum(child.interactive_count for child in item.children)
        item.field_like_count = int(item.is_field_like) + sum(child.field_like_count for child in item.children)
        item.title_like_count = int(item.is_title_like) + sum(child.title_like_count for child in item.children)
        item.module_shell_count = int(item.is_module_shell_like) + sum(child.module_shell_count for child in item.children)
        item.title = title_from_node(item)
        return item

    tree = SemanticTree(root=build(root, None, 0, "document"), by_node_id=by_node_id)
    assign_inferred_nav_zones(tree)
    assign_inferred_main_zone(tree)
    return tree


def looks_like_module_nav(item: SemanticNode) -> bool:
    if item.is_hidden or item.is_control or item.field_like_count > 0:
        return False
    if item.tag in {"document", "html", "body"}:
        return False
    if item.zone not in {"document", "body", "main", "sidebar"}:
        return False
    if item.is_module_shell_like and module_title(item):
        return False
    if inside_content_module(item):
        return False
    identity = identity_text(item.node)
    if re.search(r"(?:form|field|input|textarea|editor|upload|resumeEditForm|createFormSection)", identity, re.I):
        return False
    words = {word.lower() for word in MODULE_WORD_RE.findall(item.text)}
    return len(words) >= 3 and (item.interactive_count >= 2 or item.title_like_count >= 2 or item.control_count >= 1)


def inside_content_module(item: SemanticNode) -> bool:
    for parent in item.ancestors():
        if parent.zone in {"head", "header", "nav", "sidebar", "footer", "overlay"}:
            return False
        if parent.is_module_shell_like and module_title(parent):
            return True
    return False


def assign_inferred_nav_zones(tree: SemanticTree) -> None:
    candidates = sorted(
        (item for item in tree.walk() if looks_like_module_nav(item)),
        key=lambda item: item.depth,
    )
    for item in candidates:
        if any(child.zone == "nav" for child in item.children):
            continue
        if item.parent is not None and item.parent.zone == "nav":
            continue

        def mark(node: SemanticNode) -> None:
            if node.zone in {"document", "body", "main", "sidebar"}:
                node.zone = "nav"
            for child in node.children:
                mark(child)

        mark(item)


def assign_inferred_main_zone(tree: SemanticTree) -> None:
    candidates = [
        item
        for item in tree.walk()
        if item.zone in {"body", "main"}
        and item.tag not in {"document", "html", "body"}
        and not item.is_hidden
        and item.control_count >= 2
    ]
    if not candidates:
        return
    candidates.sort(
        key=lambda item: (
            item.control_count * 4 + item.field_like_count * 3 + item.title_like_count * 2,
            -item.depth,
        ),
        reverse=True,
    )
    main = candidates[0]

    def mark(item: SemanticNode) -> None:
        if item.zone == "body":
            item.zone = "main"
        for child in item.children:
            if child.zone == "body":
                mark(child)

    mark(main)


def likely_content_children(item: SemanticNode, title_child: SemanticNode | None) -> list[SemanticNode]:
    children: list[SemanticNode] = []
    for child in item.children:
        if child is title_child or child.is_hidden:
            continue
        if child.control_count or child.field_like_count or child.interactive_count:
            children.append(child)
    return children


def direct_title_child(item: SemanticNode) -> SemanticNode | None:
    for child in item.children:
        if child.is_hidden:
            continue
        identity = identity_text(child.node)
        if child.is_title_like or child.is_heading or TITLE_CLASS_RE.search(identity):
            if child.title or title_text_from_title_node(child):
                return child
        if child.title and child.control_count == 0:
            return child
    return None


def has_module_child(item: SemanticNode) -> bool:
    count = 0
    for child in item.children:
        if child.is_hidden or child.control_count == 0:
            continue
        if module_title(child):
            count += 1
    return count >= 2


def descendant_module_shell_count(item: SemanticNode, limit: int = 2) -> int:
    count = 0
    stack = list(item.children)
    while stack:
        child = stack.pop()
        if child.is_hidden or child.is_control:
            continue
        if child.is_module_shell_like and child.control_count and module_title(child):
            count += 1
            if count >= limit:
                return count
            continue
        stack.extend(child.children)
    return count


def module_title(item: SemanticNode) -> str:
    if item.title:
        return item.title
    title_child = direct_title_child(item)
    return title_child.title if title_child else ""


def module_candidates(tree: SemanticTree) -> list[dict[str, Any]]:
    selected: list[SemanticNode] = []
    for item in tree.walk():
        if item.tag in {"document", "html", "head", "body"} or item.is_hidden or item.is_control:
            continue
        if item.zone in {"head", "header", "nav", "sidebar", "footer", "overlay"}:
            continue
        title = module_title(item)
        if not title:
            continue
        if item.is_field_like:
            continue
        if item.control_count == 0 and item.interactive_count == 0 and item.field_like_count == 0:
            continue
        if descendant_module_shell_count(item) >= 2:
            continue
        title_child = direct_title_child(item)
        if not item.is_module_shell_like and not title_child:
            continue
        if not item.is_module_shell_like and item.control_count == 0 and item.interactive_count == 0:
            continue
        is_empty_action_module = (
            title_child is not None
            and item.interactive_count > 0
            and looks_like_module_title(title)
            and ACTION_WORD_RE.search(item.text)
        )
        if not item.is_module_shell_like and item.control_count < 2 and item.field_like_count == 0 and not is_empty_action_module:
            continue
        if item.is_field_like and item.field_like_count <= 1:
            continue
        if has_module_child(item) and not item.is_module_shell_like:
            continue
        if any(
            any(child is item for child in ancestor.children)
            or any(parent is ancestor for parent in item.ancestors())
            for ancestor in selected
        ):
            continue
        selected.append(item)

    results: list[dict[str, Any]] = []
    for index, item in enumerate(selected, start=1):
        title_child = direct_title_child(item)
        content_children = likely_content_children(item, title_child)
        results.append(
            {
                "index": index,
                "_order": item.order,
                "_node": item,
                "kind": "content",
                "title": module_title(item),
                "zone": item.zone,
                "path": item.path,
                "tag": item.tag,
                "class": item.class_name,
                **counts_field(
                    control_count=item.control_count,
                    interactive_count=item.interactive_count,
                    field_like_count=item.field_like_count,
                ),
                "title_path": title_child.path if title_child else "",
                "content_paths": [child.path for child in content_children[:6]],
                "text": clean(item.text, 160),
            }
        )
    return results


def landmark_title(item: SemanticNode) -> str:
    if item.zone == "nav":
        text = clean(item.text, 240)
        identity = identity_text(item.node)
        if re.search(r"(?:\u9996\u9875\s*/|breadcrumb|\u9762\u5305\u5c51)", f"{text} {identity}", re.I):
            return "\u9762\u5305\u5c51\u5bfc\u822a"
        if re.search(r"(?:\u7533\u8bf7\u4fe1\u606f|\u4e0a\u4f20|\u4e2a\u4eba\u4fe1\u606f|\u6559\u80b2|\u5de5\u4f5c|\u9879\u76ee|\u5b9e\u4e60|\u9644\u4ef6|\u6388\u6743|\u66f4\u65b0\u8bf4\u660e)", text):
            return "\u6a21\u5757\u76ee\u5f55"
    return ZONE_TITLES.get(item.zone, item.zone)


def nonzero_counts(**counts: int) -> dict[str, int]:
    return {key: value for key, value in counts.items() if value > 0}


def counts_field(**counts: int) -> dict[str, dict[str, int]]:
    compact = nonzero_counts(**counts)
    return {"counts": compact} if compact else {}


def is_ancestor(ancestor: SemanticNode, item: SemanticNode) -> bool:
    return any(parent is ancestor for parent in item.ancestors())


def prune_overlapping_structures(candidates: list[SemanticNode]) -> list[SemanticNode]:
    def weak_nav_wrapper(node: SemanticNode) -> bool:
        if node.zone != "nav" or clean(node.own_text):
            return False
        threshold = max(1, int(node.interactive_count * 0.4))
        return any(
            other is not node
            and other.zone == "nav"
            and is_ancestor(node, other)
            and other.interactive_count >= threshold
            for other in candidates
        )

    result: list[SemanticNode] = []
    for item in candidates:
        structural_ancestor = next(
            (
                other
                for other in candidates
                if other is not item and other.zone in STRUCTURAL_ZONES and is_ancestor(other, item)
            ),
            None,
        )
        if (
            structural_ancestor is not None
            and structural_ancestor.zone in {"header", "nav", "sidebar", "footer"}
            and not weak_nav_wrapper(structural_ancestor)
        ):
            continue
        descendants = [other for other in candidates if other is not item and is_ancestor(item, other)]
        if weak_nav_wrapper(item):
            continue
        if item.zone in {"head", "footer", "nav"}:
            result.append(item)
            continue
        if not descendants:
            result.append(item)
            continue
        strongest = max(
            descendants,
            key=lambda other: other.control_count * 4 + other.interactive_count * 2 + len(other.text),
        )
        same_signal = clean(item.text) == clean(strongest.text) or (
            strongest.control_count > 0 and strongest.control_count >= max(1, int(item.control_count * 0.8))
        )
        if item.zone == "sidebar" and any(other.zone == "nav" for other in descendants):
            continue
        if item.zone == "header" and not clean(item.own_text) and same_signal and any(other.zone == "nav" for other in descendants):
            continue
        result.append(item)
    return result


def structure_candidates(tree: SemanticTree) -> list[dict[str, Any]]:
    selected: list[SemanticNode] = []
    for item in tree.walk():
        if item.is_hidden or item.tag in {"document", "html", "body"}:
            continue
        if item.zone not in STRUCTURAL_ZONES:
            continue
        if item.parent is not None and item.parent.zone == item.zone:
            continue
        if not (item.text or item.control_count or item.interactive_count or item.tag == "head"):
            continue
        selected.append(item)

    selected = prune_overlapping_structures(selected)

    return [
        {
            "index": index,
            "_order": item.order,
            "_node": item,
            "kind": item.zone,
            "title": landmark_title(item),
            "zone": item.zone,
            "path": item.path,
            "tag": item.tag,
            "class": item.class_name,
            **counts_field(
                control_count=item.control_count,
                interactive_count=item.interactive_count,
                field_like_count=item.field_like_count,
            ),
            "text": clean(item.text, 160),
        }
        for index, item in enumerate(selected, start=1)
    ]


def zone_summaries(tree: SemanticTree) -> list[dict[str, Any]]:
    zones: dict[str, dict[str, Any]] = {}
    for item in tree.walk():
        zone = item.zone
        summary = zones.setdefault(
            zone,
            {
                "zone": zone,
                "node_count": 0,
                "control_count": 0,
                "interactive_count": 0,
                "field_like_count": 0,
                "title_like_count": 0,
                "sample_paths": [],
            },
        )
        summary["node_count"] += 1
        if item.is_control:
            summary["control_count"] += 1
        if item.is_interactive:
            summary["interactive_count"] += 1
        if item.is_field_like:
            summary["field_like_count"] += 1
        if item.is_title_like:
            summary["title_like_count"] += 1
        if len(summary["sample_paths"]) < 4 and item.control_count:
            summary["sample_paths"].append(item.path)
    for summary in zones.values():
        compact = nonzero_counts(
            control_count=summary.pop("control_count"),
            interactive_count=summary.pop("interactive_count"),
            field_like_count=summary.pop("field_like_count"),
            title_like_count=summary.pop("title_like_count"),
        )
        if compact:
            summary["counts"] = compact
    order = {"document": 0, "head": 1, "header": 2, "nav": 3, "sidebar": 4, "main": 5, "body": 6, "footer": 7, "overlay": 8}
    return sorted(zones.values(), key=lambda item: order.get(item["zone"], 99))


def summarize_document(tree: SemanticTree) -> dict[str, Any]:
    nodes = list(tree.walk())
    structures = structure_candidates(tree)
    modules = module_candidates(tree)
    module_nodes = [item["_node"] for item in modules]
    structures = [
        item
        for item in structures
        if not any(is_ancestor(module_node, item["_node"]) for module_node in module_nodes)
    ]
    page_blocks = sorted(
        [{**item} for item in [*structures, *modules]],
        key=lambda item: item.get("_order", 0),
    )
    for index, item in enumerate(page_blocks, start=1):
        item["index"] = index
    public_structures = [{key: value for key, value in item.items() if not key.startswith("_")} for item in structures]
    public_modules = [{key: value for key, value in item.items() if not key.startswith("_")} for item in modules]
    public_page_blocks = [{key: value for key, value in item.items() if not key.startswith("_")} for item in page_blocks]
    return {
        "node_count": len(nodes),
        **counts_field(
            control_count=sum(1 for item in nodes if item.is_control),
            interactive_count=sum(1 for item in nodes if item.is_interactive),
            field_like_count=sum(1 for item in nodes if item.is_field_like),
            title_like_count=sum(1 for item in nodes if item.is_title_like),
        ),
        "zones": zone_summaries(tree),
        "structure_modules": public_structures,
        "modules": public_modules,
        "page_blocks": public_page_blocks,
        "page_modules": public_page_blocks,
    }

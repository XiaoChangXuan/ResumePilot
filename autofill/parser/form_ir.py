from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class FieldIR:
    field_id: str
    label: str
    control: str
    canonical_field: str = ""
    placeholder: str = ""
    name: str = ""
    id: str = ""
    aria_label: str = ""
    context: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ModuleIR:
    module_id: str
    module: str
    title: str
    fields: list[FieldIR] = field(default_factory=list)
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class FormIR:
    page: str
    title: str = ""
    modules: list[ModuleIR] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

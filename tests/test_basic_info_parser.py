from pathlib import Path

from autofill.parser import parse_html


FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "basic_info" / "basic_info.html"


def test_parse_basic_info_module() -> None:
    ir = parse_html(FIXTURE.read_text(encoding="utf-8"))

    assert ir.title == "校园招聘申请表"
    assert len(ir.modules) == 1
    module = ir.modules[0]
    assert module.module == "basic_info"
    assert module.title == "基本信息"
    assert module.evidence["field_count"] == 5


def test_parse_basic_info_fields_without_resolving() -> None:
    ir = parse_html(FIXTURE.read_text(encoding="utf-8"))
    fields = ir.modules[0].fields

    assert [field.label for field in fields] == ["姓名", "手机号码", "邮箱", "性别", "自我评价"]
    assert [field.control for field in fields] == ["text", "tel", "email", "select", "textarea"]
    assert [field.canonical_field for field in fields] == ["", "", "", "", ""]
    assert fields[0].evidence["label_source"] == "label-for"
    assert fields[1].evidence["label_source"] == "ancestor-span"

from pathlib import Path

from autofill.parser.html_dom import parse_dom
from tools.static_field_report import module_summary, parse_fields, parse_modules, simplify_fields


FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "static" / "pingan_element_form.html"


def test_static_report_supports_pingan_element_modules() -> None:
    fields = parse_fields(parse_dom(FIXTURE.read_text(encoding="utf-8")))

    assert [field["module"] for field in fields] == ["基本信息", "基本信息", "联系信息"]
    assert [field["label"] for field in fields] == ["姓名", "最高学历", "手机号码"]
    assert [field["control_count"] for field in fields] == [1, 1, 1]


def test_static_report_summarizes_pingan_element_modules() -> None:
    root = parse_dom(FIXTURE.read_text(encoding="utf-8"))
    fields = parse_fields(root)
    parsed_modules = parse_modules(root)
    modules = {item["module"]: item for item in module_summary(fields, parsed_modules)}
    simple = simplify_fields(fields)

    assert modules["基本信息"]["field_count"] == 2
    assert modules["联系信息"]["field_count"] == 1
    assert modules["英语能力"]["field_count"] == 0
    assert modules["英语能力"]["record_count"] == 0
    assert modules["英语能力"]["add_action_count"] == 1
    assert modules["英语能力"]["add_actions"] == ["添加英语能力"]
    assert simple[0]["module"] == "基本信息"
    assert simple[0]["label"] == "姓名"


def test_static_report_keeps_youku_empty_create_form_section() -> None:
    html = """
    <div class="createFormSection-container createFormSection-container-empty">
      <div class="createFormSection-empty">
        <div class="createFormSection-title">
          <p class="createFormSection-text sofiaBold">项目经历</p>
        </div>
        <div class="createFormSection-addBtn addMore__d36c7e">
          <span class="addMore-add">添加</span>
        </div>
      </div>
    </div>
    """
    root = parse_dom(html)
    modules = module_summary(parse_fields(root), parse_modules(root))

    assert modules == [
        {
            "module": "项目经历",
            "field_count": 0,
            "record_count": 0,
            "repeated_label_count": 0,
            "labels": [],
            "repeated_labels": [],
            "add_action_count": 1,
            "add_actions": ["添加项目经历"],
        }
    ]


def test_static_report_marks_phoenix_compound_prefix_selects() -> None:
    html = """
    <div class="form-item form-item--phoenix">
      <div class="form-item__title"><label class="form-item__text">\u624b\u673a\u53f7\u7801</label></div>
      <div class="form-item__control">
        <div class="phoenix-button mobile-type-button">
          <div class="phoenix-button__wraper">
            <div class="phoenix-button__content">\u4e2d\u56fd\u5927\u9646</div>
            <span class="phoenix-button__suffixIcon"></span>
          </div>
        </div>
        <div class="phoenix-input"><input type="text"></div>
      </div>
    </div>
    <div class="form-item form-item--phoenix">
      <div class="form-item__title"><label class="form-item__text">\u8bc1\u4ef6\u53f7\u7801</label></div>
      <div class="form-item__control">
        <div class="phoenix-button mobile-type-button">
          <div class="phoenix-button__wraper">
            <div class="phoenix-button__content">\u8eab\u4efd\u8bc1</div>
            <span class="phoenix-button__suffixIcon"></span>
          </div>
        </div>
        <div class="phoenix-input"><input type="text"></div>
      </div>
    </div>
    """
    fields = parse_fields(parse_dom(html))

    assert [field["control_count"] for field in fields] == [2, 2]
    assert fields[0]["controls"][0]["semantic_key"] == "phoneCountryRegion"
    assert fields[0]["controls"][0]["semantic_label"] == "\u624b\u673a\u53f7\u7801\u5730\u533a"
    assert fields[1]["controls"][0]["semantic_key"] == "identityDocumentType"
    assert fields[1]["controls"][0]["semantic_label"] == "\u8bc1\u4ef6\u7c7b\u578b"


def test_static_report_groups_moka_graduation_year_month_controls() -> None:
    html = """
    <div class="apply-block-KRDTLLb5hU">
      <div class="blockTitle-dcmrfhpkg1"><span><span>\u4e2a\u4eba\u4fe1\u606f</span></span></div>
      <div class="apply-fields-BzcXI4i2Pm">
        <div class="apply-field-Q2iJ7AtQGX date_info-nCj8tT_zjw">
          <div class="title-IWWQ0Xa4L7"><span><span>\u6bd5\u4e1a\u65f6\u95f4</span></span></div>
          <div class="ctrl-CICMG4Fr4_">
            <div class="month-range-select date_info wrapper-Wilqy7sjl0">
              <div class="item-half-mz_My7kExy"><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u5e74"></label></div>
              <div class="item-half-mz_My7kExy"><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u6708"></label></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
    fields = parse_fields(parse_dom(html))

    assert len(fields) == 1
    assert fields[0]["module"] == "\u4e2a\u4eba\u4fe1\u606f"
    assert fields[0]["label"] == "\u6bd5\u4e1a\u65f6\u95f4"
    assert fields[0]["control_count"] == 2
    assert [control["text"] for control in fields[0]["controls"]] == ["\u5e74", "\u6708"]
    assert [control["date_part"] for control in fields[0]["controls"]] == ["year", "month"]


def test_static_report_groups_moka_study_period_year_month_controls() -> None:
    html = """
    <div class="apply-block-KRDTLLb5hU">
      <div class="blockTitle-dcmrfhpkg1"><span><span>\u6559\u80b2\u7ecf\u5386</span></span></div>
      <div class="apply-fields-BzcXI4i2Pm">
        <div class="apply-field-Q2iJ7AtQGX date_info-nCj8tT_zjw">
          <div class="title-IWWQ0Xa4L7"><span><span>\u5c31\u8bfb\u65f6\u95f4</span></span></div>
          <div class="ctrl-CICMG4Fr4_">
            <div class="month-range-select date_info wrapper-Wilqy7sjl0">
              <div><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u5e74"></label></div>
              <div><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u6708"></label></div>
              <div><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u5e74"></label></div>
              <div><label class="sd-Input-container-3OoVt"><input type="text" placeholder="\u6708"></label></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
    fields = parse_fields(parse_dom(html))

    assert len(fields) == 1
    assert fields[0]["module"] == "\u6559\u80b2\u7ecf\u5386"
    assert fields[0]["label"] == "\u5c31\u8bfb\u65f6\u95f4"
    assert fields[0]["control_count"] == 4
    assert [control["text"] for control in fields[0]["controls"]] == ["\u5e74", "\u6708", "\u5e74", "\u6708"]
    assert [control["date_part"] for control in fields[0]["controls"]] == ["year", "month", "year", "month"]
    assert [control["range_role"] for control in fields[0]["controls"]] == ["start_year", "start_month", "end_year", "end_month"]


def test_static_report_supports_formily_apply_modules_and_records() -> None:
    html = """
    <div class="applyFormModuleWrapper-windows">
      <div class="applyFormModuleWrapper-left">
        <div class="applyFormModuleWrapper-title"><p class="applyFormModuleWrapper-text">\u6559\u80b2\u7ecf\u5386</p></div>
      </div>
      <div class="applyFormModuleWrapper-right">
        <div id="formily-item-education_list" class="ud-formily-item">
          <div class="apply-form-array-card__1">
            <div class="apply-form-array-card-content__1">
              <div class="register-form-group-wrapper">
                <div data-form-field-name="school" data-form-field-i18n-name="\u5b66\u6821\u540d\u79f0" class="ud-formily-item">
                  <div class="ud-formily-item-label"><label>\u5b66\u6821\u540d\u79f0</label></div>
                  <div class="ud__input"><input class="ud__native-input" value=""></div>
                </div>
                <div data-form-field-name="degree" data-form-field-i18n-name="\u5b66\u5386" class="ud-formily-item">
                  <div class="ud-formily-item-label"><label>\u5b66\u5386</label></div>
                  <div class="ud__select"><input class="ud__native-input" role="combobox"></div>
                </div>
              </div>
            </div>
            <div class="apply-form-array-card-operate__1"><button type="button">delete</button></div>
          </div>
          <div class="apply-form-array-card__1">
            <div class="apply-form-array-card-content__1">
              <div class="register-form-group-wrapper">
                <div data-form-field-name="school" data-form-field-i18n-name="\u5b66\u6821\u540d\u79f0" class="ud-formily-item">
                  <div class="ud-formily-item-label"><label>\u5b66\u6821\u540d\u79f0</label></div>
                  <div class="ud__input"><input class="ud__native-input" value=""></div>
                </div>
              </div>
            </div>
            <div class="apply-form-array-card-operate__1"><button type="button">delete</button></div>
          </div>
        </div>
      </div>
    </div>
    """
    root = parse_dom(html)
    fields = parse_fields(root)
    modules = {item["module"]: item for item in module_summary(fields, parse_modules(root))}
    simple = simplify_fields(fields)

    assert modules["\u6559\u80b2\u7ecf\u5386"]["field_count"] == 3
    assert modules["\u6559\u80b2\u7ecf\u5386"]["record_count"] == 2
    assert [field["module"] for field in fields] == ["\u6559\u80b2\u7ecf\u5386"] * 3
    assert [field["label"] for field in fields] == ["\u5b66\u6821\u540d\u79f0", "\u5b66\u5386", "\u5b66\u6821\u540d\u79f0"]
    assert [field["record_index"] for field in fields] == [1, 1, 2]
    assert [field["record_total"] for field in fields] == [2, 2, 2]
    assert simple[0]["record_index"] == 1
    assert simple[2]["label_with_index"] == "\u5b66\u6821\u540d\u79f02"


def test_static_report_keeps_empty_formily_apply_module() -> None:
    html = """
    <div class="applyFormModuleWrapper-empty applyFormModuleWrapper-windows">
      <div class="applyFormModuleWrapper-left">
        <div class="applyFormModuleWrapper-title"><p class="applyFormModuleWrapper-text">\u8bed\u8a00\u80fd\u529b</p></div>
      </div>
      <div class="applyFormModuleWrapper-right">
        <div id="formily-item-language_list" class="ud-formily-item">
          <button type="button" class="ud__button apply-form-array-card-add-float-right__1">\u6dfb\u52a0</button>
        </div>
      </div>
    </div>
    """
    modules = module_summary(parse_fields(parse_dom(html)), parse_modules(parse_dom(html)))

    assert modules == [
        {
            "module": "\u8bed\u8a00\u80fd\u529b",
            "field_count": 0,
            "record_count": 0,
            "repeated_label_count": 0,
            "labels": [],
            "repeated_labels": [],
            "add_action_count": 1,
            "add_actions": ["\u6dfb\u52a0\u8bed\u8a00\u80fd\u529b"],
        }
    ]


def test_static_report_infers_plain_modules_fields_and_records() -> None:
    html = """
    <section>
      <h2>\u6559\u80b2\u7ecf\u5386</h2>
      <div class="records">
        <div class="item">
          <div><span>\u5b66\u6821\u540d\u79f0</span><input></div>
          <div><span>\u5b66\u5386</span><select></select></div>
          <div><span>\u5c31\u8bfb\u65f6\u95f4</span><button>\u5e74</button><button>\u6708</button><button>\u5e74</button><button>\u6708</button></div>
        </div>
        <div class="item">
          <div><span>\u5b66\u6821\u540d\u79f0</span><input></div>
          <div><span>\u5b66\u5386</span><select></select></div>
          <div><span>\u5c31\u8bfb\u65f6\u95f4</span><button>\u5e74</button><button>\u6708</button><button>\u5e74</button><button>\u6708</button></div>
        </div>
      </div>
    </section>
    """
    root = parse_dom(html)
    fields = parse_fields(root)
    modules = {item["module"]: item for item in module_summary(fields, parse_modules(root))}

    assert modules["\u6559\u80b2\u7ecf\u5386"]["field_count"] == 6
    assert modules["\u6559\u80b2\u7ecf\u5386"]["record_count"] == 2
    assert [field["module"] for field in fields] == ["\u6559\u80b2\u7ecf\u5386"] * 6
    assert [field["label"] for field in fields[:3]] == ["\u5b66\u6821\u540d\u79f0", "\u5b66\u5386", "\u5c31\u8bfb\u65f6\u95f4"]
    assert [field["record_index"] for field in fields] == [1, 1, 1, 2, 2, 2]
    assert [field["record_total"] for field in fields] == [2] * 6
    assert [control["range_role"] for control in fields[2]["controls"]] == ["start_year", "start_month", "end_year", "end_month"]


def test_static_report_does_not_group_plain_basic_fields_as_records() -> None:
    html = """
    <section>
      <h2>\u4e2a\u4eba\u4fe1\u606f</h2>
      <div class="grid">
        <div><label>\u59d3\u540d</label><input></div>
        <div><label>\u624b\u673a\u53f7</label><input></div>
        <div><label>\u90ae\u7bb1</label><input></div>
      </div>
    </section>
    """
    fields = parse_fields(parse_dom(html))

    assert [field["module"] for field in fields] == ["\u4e2a\u4eba\u4fe1\u606f"] * 3
    assert [field["label"] for field in fields] == ["\u59d3\u540d", "\u624b\u673a\u53f7", "\u90ae\u7bb1"]
    assert [field["record_total"] for field in fields] == [0, 0, 0]


def test_static_report_groups_plain_graduation_year_month_under_same_field() -> None:
    html = """
    <section>
      <h2>\u4e2a\u4eba\u4fe1\u606f</h2>
      <div><span>\u6bd5\u4e1a\u65f6\u95f4</span><button>\u5e74</button><button>\u6708</button></div>
    </section>
    """
    fields = parse_fields(parse_dom(html))

    assert len(fields) == 1
    assert fields[0]["module"] == "\u4e2a\u4eba\u4fe1\u606f"
    assert fields[0]["label"] == "\u6bd5\u4e1a\u65f6\u95f4"
    assert [control["text"] for control in fields[0]["controls"]] == ["\u5e74", "\u6708"]
    assert [control["date_part"] for control in fields[0]["controls"]] == ["year", "month"]


def test_static_report_prefers_send_title_over_help_text() -> None:
    html = """
    <li id="page-resume-sections0" class="send_box sendBorder">
      <div class="send_title">\u5185\u63a8\u4e32\u7801</div>
      <div class="send_content">
        <div class="info_box"><span>\u5185\u63a8\u4e32\u7801</span><input></div>
      </div>
      <div class="unloadTip">\u817e\u8baf\u4e0d\u4f1a\u4ee5\u4efb\u4f55\u5f62\u5f0f\u8fdb\u884c\u4ed8\u8d39\u5185\u63a8\uff0c\u8bf7\u8c28\u9632\u53d7\u9a97\u3002</div>
      <div class="unloadTip">\u5185\u63a8\u4e32\u7801\u7684\u76ee\u7684\u5728\u4e8e\u4ece\u4f2f\u4e50\u5904\u83b7\u53d6\u66f4\u591a\u5173\u4e8e\u817e\u8baf\u3001\u610f\u5411\u5c97\u4f4d\u7684\u4fe1\u606f\uff0c\u66f4\u6709\u9488\u5bf9\u6027\u7684\u51c6\u5907\u9762\u8bd5\u3002</div>
    </li>
    """
    root = parse_dom(html)
    fields = parse_fields(root)
    modules = module_summary(fields, parse_modules(root))

    assert modules[0]["module"] == "\u5185\u63a8\u4e32\u7801"
    assert fields[0]["module"] == "\u5185\u63a8\u4e32\u7801"


def test_static_report_trims_send_title_description_child() -> None:
    html = """
    <li class="send_box sendBorder">
      <div class="send_title">
        <span>\u4f5c\u54c1\u6216\u4e2a\u4eba\u4e3b\u9875</span>
        <div class="title_text">\u53ef\u5c55\u793a\u4f5c\u54c1\u96c6\u6216\u5176\u4ed6\u9644\u4ef6</div>
      </div>
      <div class="send_content">
        <div class="info_box"><span>GitHub</span><input></div>
      </div>
    </li>
    """
    root = parse_dom(html)
    fields = parse_fields(root)
    modules = module_summary(fields, parse_modules(root))

    assert modules[0]["module"] == "\u4f5c\u54c1\u6216\u4e2a\u4eba\u4e3b\u9875"
    assert fields[0]["module"] == "\u4f5c\u54c1\u6216\u4e2a\u4eba\u4e3b\u9875"

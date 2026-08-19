from autofill.parser.html_dom import parse_dom
from autofill.parser.semantic_tree import build_semantic_tree, summarize_document


def module_titles(html: str) -> list[str]:
    tree = build_semantic_tree(parse_dom(html))
    return [module["title"] for module in summarize_document(tree)["modules"]]


def test_semantic_tree_keeps_title_container_with_add_button() -> None:
    html = """
    <div class="apply-block">
      <div class="blockTitle-dcmrfhpkg1"><span>教育背景</span><button>添加</button></div>
      <div class="apply-fields"><div class="apply-field"><label>学校名称</label><input></div></div>
    </div>
    """

    assert module_titles(html) == ["教育背景"]


def test_semantic_tree_prefers_real_module_title_over_empty_state_label() -> None:
    html = """
    <li class="send_box">
      <label class="el-checkbox no_experience">无实习经历</label>
      <div class="send_title">实习经历</div>
      <div class="send_content"><div class="info_box"><span>公司名称</span><input></div></div>
    </li>
    """

    assert module_titles(html) == ["实习经历"]


def test_semantic_tree_does_not_treat_repeatable_as_nav() -> None:
    html = """
    <div class="createFormSection-container">
      <div class="resumeEditForm-education createFormSection-mutiple createFormSection-repeatable">
        <div class="createFormSection-left"><div class="createFormSection-title"><p>教育经历</p></div></div>
        <div class="createFormSection-right"><div class="atsx-form-item"><label>学校名称</label><input></div></div>
      </div>
    </div>
    """
    tree = build_semantic_tree(parse_dom(html))
    report = summarize_document(tree)

    assert [module["title"] for module in report["modules"]] == ["教育经历"]
    assert report["modules"][0]["zone"] != "nav"


def test_semantic_tree_keeps_empty_module_with_div_add_button() -> None:
    html = """
    <div class="createFormSection-container createFormSection-container-empty">
      <div class="resumeEditForm-project createFormSection-mutiple createFormSection-empty createFormSection-repeatable">
        <div class="createFormSection-left"><div class="createFormSection-title"><p>项目经历</p></div></div>
        <div class="createFormSection-right">
          <div class="createFormSection-addBtn addMore__d36c7e"><span class="addMore-add">添加</span></div>
        </div>
      </div>
    </div>
    """

    assert module_titles(html) == ["项目经历"]


def test_semantic_tree_keeps_empty_non_shell_module_with_single_add_button() -> None:
    html = """
    <div id="account" class="wrapper-education-experience_wrapper__XEK_S">
      <div class="divider-title_divider__8bzpH"><div class="divider-title_title__fXWvL">社交账号</div></div>
      <div class="wrapper-education-experience_list__mzlEG">
        <form class="ant-form ant-form-horizontal"></form>
        <button type="button" class="ant-btn wrapper-education-experience_addBtn__P_Jlh ant-btn-block">添加社交账号</button>
      </div>
    </div>
    """

    assert module_titles(html) == ["社交账号"]


def test_semantic_tree_does_not_select_outer_container_that_wraps_modules() -> None:
    html = """
    <div class="page">
      <div class="left-side"><h1>华勤技术</h1>
        <div class="apply-block"><div class="blockTitle">个人信息</div><div><label>姓名</label><input></div></div>
        <div class="apply-block"><div class="blockTitle">教育背景</div><div><label>学校名称</label><input></div></div>
      </div>
    </div>
    """

    assert module_titles(html) == ["个人信息", "教育背景"]


def test_semantic_tree_separates_navigation_and_footer_from_business_modules() -> None:
    html = """
    <div class="apply-page">
      <div class="side-panel">
        <ul class="nav-list">
          <li class="nav-item"><button>\u4e0a\u4f20</button></li>
          <li class="nav-item"><button>\u6559\u80b2\u80cc\u666f</button></li>
          <li class="nav-item"><button>\u66f4\u65b0\u8bf4\u660e</button></li>
        </ul>
      </div>
      <main class="apply-content">
        <div class="apply-block"><div class="blockTitle">\u6559\u80b2\u80cc\u666f</div><div><label>\u5b66\u6821\u540d\u79f0</label><input></div></div>
      </main>
      <div class="footer-container"><a>\u4eac\u516c\u7f51\u5b89\u5907 11010802024479\u53f7</a><a>ICP\u5907</a></div>
    </div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u6559\u80b2\u80cc\u666f"]
    structures = {(item["kind"], item["title"]) for item in report["structure_modules"]}
    assert ("nav", "\u5206\u533a\u5bfc\u822a") in structures
    assert ("footer", "\u9875\u811a") in structures


def test_semantic_tree_treats_overlay_as_surface_not_module() -> None:
    html = """
    <main class="apply-content">
      <div class="apply-block"><div class="blockTitle">\u4e2a\u4eba\u4fe1\u606f</div><label>\u59d3\u540d</label><input></div>
      <div class="sd-Dropdown-container" role="listbox"><button>\u5317\u4eac</button><button>\u4e0a\u6d77</button></div>
      <div class="sd-Tooltip-container" role="tooltip">\u63d0\u793a\u5185\u5bb9</div>
    </main>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u4e2a\u4eba\u4fe1\u606f"]
    assert all(item["kind"] != "overlay" for item in report["structure_modules"])
    assert "overlay" in {zone["zone"] for zone in report["zones"]}


def test_semantic_tree_does_not_treat_bottom_textarea_bar_as_footer() -> None:
    html = """
    <main class="apply-content">
      <div class="apply-block">
        <div class="blockTitle">\u9ad8\u7ea7\u4fe1\u606f</div>
        <div class="phoenix-textarea phoenix-textarea--hasBottomBar">
          <textarea></textarea><span>0 / 2000</span>
        </div>
      </div>
    </main>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u9ad8\u7ea7\u4fe1\u606f"]
    assert all(item["kind"] != "footer" for item in report["structure_modules"])


def test_semantic_tree_does_not_treat_fixed_action_bar_as_footer() -> None:
    html = """
    <main class="apply-content">
      <div class="apply-block"><div class="blockTitle">\u6559\u80b2\u80cc\u666f</div><label>\u5b66\u6821\u540d\u79f0</label><input></div>
    </main>
    <div class="page-bottom-bar"><button>\u6682\u5b58</button><button>\u53d6\u6d88</button><button>\u9884\u89c8\u5e76\u63d0\u4ea4</button></div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u6559\u80b2\u80cc\u666f"]
    assert all(item["kind"] != "footer" for item in report["structure_modules"])


def test_semantic_tree_prunes_sidebar_shell_when_it_only_wraps_module_nav() -> None:
    html = """
    <div class="side-panel">
      <ul class="nav-list">
        <li><button>\u4e0a\u4f20</button></li>
        <li><button>\u4e2a\u4eba\u4fe1\u606f</button></li>
        <li><button>\u6559\u80b2\u80cc\u666f</button></li>
      </ul>
    </div>
    <main class="apply-content">
      <div class="apply-block"><div class="blockTitle">\u4e2a\u4eba\u4fe1\u606f</div><label>\u59d3\u540d</label><input></div>
    </main>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))
    structures = [(item["kind"], item["title"]) for item in report["structure_modules"]]

    assert ("nav", "\u5206\u533a\u5bfc\u822a") in structures
    assert all(item[0] != "sidebar" for item in structures)


def test_semantic_tree_ignores_extension_roots() -> None:
    html = """
    <main class="apply-content">
      <div class="apply-block"><div class="blockTitle">\u57fa\u672c\u4fe1\u606f</div><label>\u59d3\u540d</label><input></div>
    </main>
    <div id="aminer-ai-extension-root">
      <template><div class="top-0"><button>\u767b\u5f55</button> AMiner</div></template>
    </div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u57fa\u672c\u4fe1\u606f"]
    assert all("AMiner" not in item["text"] for item in report["structure_modules"])


def test_semantic_tree_treats_cascader_menu_as_overlay_not_nav() -> None:
    html = """
    <main class="apply-content">
      <div class="apply-block"><div class="blockTitle">\u57fa\u672c\u4fe1\u606f</div><label>\u57ce\u5e02</label><input></div>
    </main>
    <div id="cascader-menu-1"><div class="el-cascader-menu__wrap"><button>\u5317\u4eac</button><button>\u4e0a\u6d77</button></div></div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u57fa\u672c\u4fe1\u606f"]
    assert all("cascader-menu" not in item["path"] for item in report["structure_modules"])
    assert "overlay" in {zone["zone"] for zone in report["zones"]}


def test_semantic_tree_omits_zero_count_fields() -> None:
    empty_report = summarize_document(build_semantic_tree(parse_dom("<main><p>Plain text</p></main>")))
    assert "counts" not in empty_report

    field_report = summarize_document(build_semantic_tree(parse_dom("<main><label>Name</label><input></main>")))
    assert field_report["counts"]
    assert all(value > 0 for value in field_report["counts"].values())


def test_semantic_tree_does_not_treat_left_side_content_as_sidebar() -> None:
    html = """
    <div class="left-side">
      <ul class="breadcrumb"><li><a>\u9996\u9875</a></li><li><a>\u804c\u4f4d\u7533\u8bf7</a></li></ul>
      <ul class="nav-list"><li>\u7533\u8bf7\u4fe1\u606f</li><li>\u4e2a\u4eba\u4fe1\u606f</li><li>\u6559\u80b2\u80cc\u666f</li></ul>
      <div class="apply-block"><div class="blockTitle">\u7533\u8bf7\u4fe1\u606f</div><label>\u610f\u5411\u57ce\u5e02</label><input></div>
      <div class="apply-block"><div class="blockTitle">\u4e2a\u4eba\u4fe1\u606f</div><label>\u59d3\u540d</label><input></div>
    </div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u7533\u8bf7\u4fe1\u606f", "\u4e2a\u4eba\u4fe1\u606f"]
    assert all(item["kind"] != "sidebar" for item in report["structure_modules"])


def test_semantic_tree_keeps_field_only_additional_info_as_one_module() -> None:
    html = """
    <div class="createFormSection-container">
      <div class="resumeEditForm-additional createFormSection createFormSection__section">
        <div class="createFormSection-title"><p>\u9644\u52a0\u4fe1\u606f</p></div>
        <div class="createFormSection-content">
          <div class="form-item"><label>\u5174\u8da3\u7231\u597d</label><div>\u7bee\u7403</div></div>
          <div class="form-item"><label>\u4e13\u4e1a\u7ec4\u7ec7</label><div>\u8ba1\u7b97\u673a\u534f\u4f1a</div></div>
          <div class="form-item"><label>\u5197\u4f59\u4fe1\u606f</label><div>\u65e0</div></div>
        </div>
      </div>
    </div>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))

    assert [module["title"] for module in report["modules"]] == ["\u9644\u52a0\u4fe1\u606f"]


def test_semantic_tree_infers_module_navigation_without_form_fields() -> None:
    html = """
    <div class="attachment-anchor-list">
      <button>\u7533\u8bf7\u4fe1\u606f</button>
      <button>\u4e0a\u4f20\u7b80\u5386</button>
      <button>\u9644\u4ef6\u7b80\u5386</button>
      <button>\u6559\u80b2\u7ecf\u5386</button>
    </div>
    <main><div class="createFormSection"><div class="createFormSection-title"><p>\u9644\u4ef6\u7b80\u5386</p></div><button>\u9009\u62e9\u6587\u4ef6</button></div></main>
    """
    report = summarize_document(build_semantic_tree(parse_dom(html)))
    structures = {(item["kind"], item["title"]) for item in report["structure_modules"]}

    assert ("nav", "\u5206\u533a\u5bfc\u822a") in structures
    assert [module["title"] for module in report["modules"]] == ["\u9644\u4ef6\u7b80\u5386"]

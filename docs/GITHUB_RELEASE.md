# GitHub 发布文案

## Repository About

Description:

```text
ResumePilot: 本地优先的浏览器简历自动填写扩展，解析招聘页面结构并安全填写当前页。
```

Topics:

```text
chrome-extension, edge-extension, resume, autofill, job-application, browser-extension, local-first
```

## 0.0.1 Release

Title:

```text
0.0.1
```

Body:

```markdown
首个开源预览版，提供 Chrome 和 Edge 两个 Manifest V3 扩展包。

### 下载

- Chrome: `resumepilot-chrome-v0.0.1.zip`
- Edge: `resumepilot-edge-v0.0.1.zip`

两个包当前内容一致，仅按浏览器命名区分。

### 主要能力

- 本地保存求职资料和简历附件。
- 支持 PDF 简历解析到资料页。
- 解析当前招聘页面结构，输出字段、模块、按钮、导航、页头/页脚和弹层信息。
- 将页面字段映射到统一资料路径。
- 支持直接写入、输入后选择、封闭下拉、日期/年月、地区级联、搜索勾选、排名区间等部分控件。
- 支持教育、实习、项目等奖励/经历重复区块的添加和顺序填写。
- 填写过程带进度遮罩、暂停/取消和日志下载。

### 安全边界

- 不会自动投递。
- 不会点击删除、重置、跳转、下一步等危险动作。
- 个人资料和附件只保存在本地浏览器。
- 当前未接入 AI；未来可能用 AI 处理未知控件、模糊字段和失败候选。

### 安装

1. 下载对应 zip 并解压。
2. Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`。
3. 打开开发者模式。
4. 选择“加载已解压的扩展程序”。
5. 选择解压目录。
```

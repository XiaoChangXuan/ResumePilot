# 统一求职资料模型

## 目标

个人资料不按某一家招聘网站的 HTML 保存，而是按稳定业务含义保存。页面解析器负责把不同公司的字段名称映射到统一路径，填写引擎只消费这些路径。

例如：

| 页面字段文字 | 统一资料路径 |
| --- | --- |
| 姓名、真实姓名、候选人姓名 | `basic.fullName` |
| 手机、手机号码、联系电话 | `basic.phone` |
| 应聘岗位、申请职位、目标职位 | `jobPreferences.applicationPosition` |
| 学校名称、毕业院校、最高学历毕业院校中文全称 | `educationExperiences[].schoolName` |
| 单位名称、公司名称 | `workExperiences[].companyName` |
| 工作职责、实习内容、工作内容 | `workExperiences[].description` |
| 英语等级、等级/证书 | `languageSkills[].certificate` |

## 顶层结构

```text
profile
├─ basic                         基本身份、联系方式、户籍
├─ jobPreferences                求职意向、薪资、到岗与调剂
├─ highSchool                    高中与高考信息
├─ familyMembers[]               家庭成员 / 联系人
├─ educationExperiences[]        教育经历
├─ workExperiences[]             工作 / 实习经历
├─ campusExperiences[]           校园任职
├─ projectExperiences[]          项目经历
├─ practiceExperiences[]         社会实践
├─ languageSkills[]              语言能力
├─ certificates[]                证书与职业资格
├─ awards[]                      奖励与荣誉
├─ skills[]                      技能
├─ publications[]                论文 / 发表成果
├─ patents[]                     专利
├─ linksAndSummary               链接、自我评价、兴趣与补充
├─ qualifications                常见资格与意愿
├─ customAnswers[]               公司专项问题与回答
└─ attachments                  本地附件元数据
```

## 重复经历

教育、工作、项目等实际数据使用数组保存，不保存为 `学校名称1、学校名称2`。页面审计为了方便人工查看仍可以显示带序号的 `displayName`，但真正映射路径保持为 `educationExperiences[].schoolName`，后续再依据页面区块序号选择数组中的第几项。

ATSX 等起止日期还会输出：

- `rangeGroup`：同一组起止时间的结构标识，例如 `education[0].period`
- `rangeRole`：`start | end`
- `rangeIndex`：从 1 开始的重复经历序号

## 歧义处理

“姓名”“职务”“开始时间”“掌握程度”等文字可能对应多个资料路径。解析时按以下顺序处理：

1. 页面区块语义，例如教育、工作、项目、家庭、语言。
2. 已识别的稳定语义键 `matchedKey`。
3. 字段别名精确匹配。
4. 仍不唯一时不猜测，输出 `profilePathCandidates`，状态为 `ambiguous`。

例如家庭成员区块中的“姓名”映射到 `familyMembers[].name`，基本信息区的“姓名”映射到 `basic.fullName`。

## 公司专项问题

“是否为某培训机构学员”“为何加入本公司”等问题不应污染公共基本信息：

- 常见且跨公司复用的问题放入 `qualifications`。
- 只适用于特定公司的原文与答案放入 `customAnswers[]`，并保存适用公司。
- 不确定、敏感或具有法律含义的问题不设置默认答案。

## 附件

证件照、简历、成绩单、英语证书、获奖证书、专利证书和其他附件保存在当前浏览器 IndexedDB。个人资料 JSON 只导出附件元数据，不包含二进制文件。

## 实现文件

- `profile-schema.js`：全面的统一字段、页面别名与动态问题语义模式
- `profile.html / profile.css / profile.js`：本地个人资料编辑页
- `content.js`：页面控件解析以及 `profilePath` 映射
- `autofill.js`：重复区块补足、分阶段填写、候选匹配与速度统计

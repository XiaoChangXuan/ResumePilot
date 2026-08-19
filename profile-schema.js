(() => {
  const yesNoOptions = ['', '是', '否', '不确定/不披露'];
  const proficiencyOptions = ['', '精通', '熟练', '良好', '一般', '基础'];
  const degreeOptions = ['', '初中及以下', '中专', '高中', '大专', '本科', '硕士', '博士', 'MBA', '其他'];

  const sections = [
    {
      key: 'basic', title: '基本信息', description: '身份、联系方式、户籍与常用人口信息。', fields: [
        { key: 'fullName', label: '姓名', required: true, aliases: ['真实姓名', '候选人姓名', '申请人姓名', '中文名'] },
        { key: 'englishName', label: '英文名', aliases: ['英文姓名', '拼音姓名'] },
        { key: 'firstName', label: '名 / First name', aliases: ['given name'] },
        { key: 'lastName', label: '姓 / Last name', aliases: ['family name', 'surname'] },
        { key: 'gender', label: '性别', type: 'select', options: ['', '男', '女', '保密/不披露'] },
        { key: 'birthDate', label: '出生日期', type: 'date', aliases: ['出生年月', '生日', '出生日期 (年龄)'] },
        { key: 'phone', label: '手机号码', type: 'tel', required: true, aliases: ['手机', '联系电话', '电话号码'] },
        { key: 'phoneCountryRegion', label: '手机号码地区', type: 'select', options: ['', '中国大陆', '中国港澳台', '国外'], aliases: ['手机号地区', '手机区号', '电话地区'] },
        { key: 'alternatePhone', label: '备用联系电话', type: 'tel', aliases: ['其他联系电话'] },
        { key: 'email', label: '邮箱', type: 'email', required: true, aliases: ['电子邮箱', '电子邮件'] },
        { key: 'wechat', label: '微信号', aliases: ['微信'] },
        { key: 'qq', label: 'QQ号', aliases: ['QQ'] },
        { key: 'countryRegion', label: '国家/地区', aliases: ['国家', '国籍'] },
        { key: 'ethnicity', label: '民族' },
        { key: 'politicalStatus', label: '政治面貌', type: 'select', options: ['', '中共党员', '中共预备党员', '共青团员', '群众', '民主党派', '其他'] },
        { key: 'maritalStatus', label: '婚姻状况', type: 'select', options: ['', '未婚', '已婚', '离异', '不披露'] },
        { key: 'fertilityStatus', label: '生育状况', type: 'select', options: ['', '未育', '已育', '不披露'] },
        { key: 'healthStatus', label: '健康状况' },
        { key: 'heightCm', label: '身高（厘米）', type: 'number', min: 50, max: 250, aliases: ['身高(厘米)', '身高'] },
        { key: 'weightKg', label: '体重（公斤）', type: 'number', min: 20, max: 300, step: '0.1', aliases: ['体重(公斤)', '体重'] },
        { key: 'nativePlace', label: '籍贯（完整）', aliases: ['祖籍'] },
        { key: 'nativePlaceProvince', label: '籍贯－省/直辖市' },
        { key: 'nativePlaceCity', label: '籍贯－市/地区' },
        { key: 'nativePlaceDistrict', label: '籍贯－区/县' },
        { key: 'studentOrigin', label: '生源地', aliases: ['高考生源地'] },
        { key: 'householdRegistration', label: '户口所在地', aliases: ['户籍所在地', '户籍'] },
        { key: 'currentResidence', label: '现居地', aliases: ['所在地', '当前居住地'] },
        { key: 'city', label: '所在城市', aliases: ['城市'] },
        { key: 'address', label: '通讯地址', wide: true, aliases: ['详细地址', '联系地址', '居住地址'] },
        { key: 'postalCode', label: '邮政编码', aliases: ['邮编'] },
        { key: 'identityDocumentType', label: '证件类型', type: 'select', options: ['', '身份证', '护照', '港澳居民来往内地通行证', '台湾居民来往大陆通行证', '军人证', '其他'], aliases: ['证件类别'] },
        { key: 'identityDocumentNumber', label: '证件号码', sensitive: true, aliases: ['身份证号', '护照号', '证书号码'] },
        { key: 'identityDocumentExpiry', label: '证件有效期', type: 'date' }
      ]
    },
    {
      key: 'jobPreferences', title: '求职意向', description: '应聘岗位、城市、薪资、到岗时间和调剂意愿。', fields: [
        { key: 'referralCode', label: '推荐码', aliases: ['内推码'] },
        { key: 'referralMethod', label: '推荐方式', aliases: ['推荐渠道', '内推'] },
        { key: 'applicationPosition', label: '应聘岗位', aliases: ['申请职位', '目标职位', '职位关键词'] },
        { key: 'desiredOccupation', label: '期望从事职业', aliases: ['期望职位'] },
        { key: 'desiredCities', label: '期望工作城市', aliases: ['意向城市', '期望城市'] },
        { key: 'businessTravelIntent', label: '出差意向', type: 'select', options: ['', '接受', '有限接受', '不接受'] },
        { key: 'overseasTravelIntent', label: '出国意向', type: 'select', options: ['', '接受', '有限接受', '不接受'], aliases: ['出差出国意向'] },
        { key: 'currentMonthlySalary', label: '目前月薪', aliases: ['当前薪资（月薪）', '目前薪资（月薪）'] },
        { key: 'expectedMonthlySalary', label: '期望月薪（税前）', aliases: ['期望薪资（月薪）', '期望月薪'] },
        { key: 'expectedAnnualSalary', label: '期望年薪' },
        { key: 'yearsExperience', label: '工作年限', type: 'number', min: 0, step: '0.5' },
        { key: 'jobStatus', label: '求职状态', type: 'select', options: ['', '应届毕业生', '在职－考虑机会', '在职－暂不考虑', '离职－随时到岗', '其他'] },
        { key: 'availableDate', label: '预计报到时间', type: 'date', aliases: ['可到岗日期', '预计到岗时间', '最早到岗日期'] },
        { key: 'acceptsAdjustment', label: '是否接受岗位调剂', type: 'select', options: yesNoOptions, aliases: ['是否服从调配', '是否接受调剂'] },
        { key: 'adjustmentDirection', label: '意愿调剂方向' },
        { key: 'recruitmentSource', label: '何处得知招聘信息', aliases: ['招聘信息来源', '从哪里了解到招聘', '招聘渠道'] },
        { key: 'whyCompany', label: '为何加入本公司', type: 'textarea', wide: true, aliases: ['为什么选择本公司', '求职动机'] }
      ]
    },
    {
      key: 'highSchool', title: '高中与高考信息', description: '部分校园招聘会单独要求。', fields: [
        { key: 'schoolName', label: '高中学校名称' },
        { key: 'gaokaoYear', label: '高考年份', type: 'number', min: 1980, max: 2100 },
        { key: 'studentOrigin', label: '高考生源地' },
        { key: 'subjectTrack', label: '文理科情况', type: 'select', options: ['', '文科', '理科', '综合改革', '其他'] },
        { key: 'score', label: '高考分数', type: 'number', min: 0 }
      ]
    },
    {
      key: 'familyMembers', title: '家庭成员 / 联系人', repeatable: true, itemTitle: '成员', description: '父母、紧急联系人或证明联系人；页面含义明确时再使用。', fields: [
        { key: 'name', label: '姓名', aliases: ['成员姓名', '证明人姓名'] },
        { key: 'relationship', label: '与本人关系', aliases: ['关系'] },
        { key: 'phone', label: '联系电话', type: 'tel', aliases: ['证明人联系方式'] },
        { key: 'workUnit', label: '工作单位', aliases: ['单位名称'] },
        { key: 'jobTitle', label: '职务', aliases: ['职业', '职位'] },
        { key: 'location', label: '所在地' }
      ]
    },
    {
      key: 'educationExperiences', title: '教育经历', repeatable: true, itemTitle: '教育经历', description: '本科、硕士、博士、高中等均按数组保存。', fields: [
        { key: 'schoolName', label: '学校名称', required: true, aliases: ['毕业院校', '最高学历毕业院校中文全称', '本科学校', '硕士学校', '博士学校'] },
        { key: 'collegeName', label: '学院名称', aliases: ['院系名称', '院系'] },
        { key: 'major', label: '专业名称', aliases: ['专业', '本科专业', '硕士专业', '博士专业'] },
        { key: 'degree', label: '学历', type: 'select', options: degreeOptions, aliases: ['最高学历'] },
        { key: 'academicDegree', label: '学位', aliases: ['所获学位'] },
        { key: 'startDate', label: '开始时间', type: 'month', aliases: ['入学时间', '就读开始时间'] },
        { key: 'endDate', label: '结束时间', type: 'month', aliases: ['毕业时间', '预计毕业时间', '就读结束时间'] },
        { key: 'gpa', label: '成绩（GPA）', aliases: ['GPA', '成绩(GPA)'] },
        { key: 'ranking', label: '专业排名', aliases: ['成绩排名'] },
        { key: 'rankingPercent', label: '排名百分比', aliases: ['排名占比'] },
        { key: 'studyMode', label: '学习形式', aliases: ['学历类型', '培养方式', '就读形式'] },
        { key: 'countryRegion', label: '学校所在国家/地区' },
        { key: 'advisor', label: '导师' },
        { key: 'isHighest', label: '是否最高学历', type: 'select', options: yesNoOptions },
        { key: 'recommendedPostgraduate', label: '硕士是否保研', type: 'select', options: yesNoOptions, aliases: ['硕士学位是否为保研'] },
        { key: 'directPhd', label: '博士是否直博', type: 'select', options: yesNoOptions, aliases: ['博士是否为直博'] }
      ]
    },
    {
      key: 'workExperiences', title: '工作 / 实习经历', repeatable: true, itemTitle: '工作经历', fields: [
        { key: 'type', label: '经历类型', type: 'select', options: ['', '实习', '正式工作', '兼职', '其他'] },
        { key: 'companyName', label: '公司名称', required: true, aliases: ['单位名称', '工作单位'] },
        { key: 'department', label: '部门名称', aliases: ['工作部门', '实习部门'] },
        { key: 'jobTitle', label: '职位名称', aliases: ['职务名称', '职位', '职务'] },
        { key: 'workNature', label: '工作性质' },
        { key: 'location', label: '工作地点' },
        { key: 'startDate', label: '开始时间', type: 'month' },
        { key: 'endDate', label: '结束时间', type: 'month' },
        { key: 'monthlySalary', label: '月薪（元）', aliases: ['月薪'] },
        { key: 'referenceName', label: '证明人姓名', aliases: ['证明人'] },
        { key: 'referencePhone', label: '证明人联系方式', type: 'tel' },
        { key: 'description', label: '工作 / 实习内容', type: 'textarea', wide: true, aliases: ['工作职责', '实习内容', '工作内容', '描述'] },
        { key: 'achievement', label: '工作成绩', type: 'textarea', wide: true, aliases: ['工作及成绩'] }
      ]
    },
    {
      key: 'campusExperiences', title: '校园任职', repeatable: true, itemTitle: '校园经历', fields: [
        { key: 'organization', label: '组织 / 社团名称' },
        { key: 'jobTitle', label: '校内任职职务', aliases: ['职务名称'] },
        { key: 'startDate', label: '开始时间', type: 'month' },
        { key: 'endDate', label: '结束时间', type: 'month' },
        { key: 'description', label: '职务描述', type: 'textarea', wide: true, aliases: ['校园经历信息'] }
      ]
    },
    {
      key: 'projectExperiences', title: '项目经历', repeatable: true, itemTitle: '项目', fields: [
        { key: 'name', label: '项目名称', required: true },
        { key: 'role', label: '项目职务 / 角色', aliases: ['职务', '职责', '项目中职责'] },
        { key: 'startDate', label: '开始时间', type: 'month' },
        { key: 'endDate', label: '结束时间', type: 'month' },
        { key: 'description', label: '项目描述', type: 'textarea', wide: true },
        { key: 'achievement', label: '项目成果', type: 'textarea', wide: true }
      ]
    },
    {
      key: 'practiceExperiences', title: '社会实践', repeatable: true, itemTitle: '实践经历', fields: [
        { key: 'name', label: '实践名称' },
        { key: 'role', label: '承担角色' },
        { key: 'startDate', label: '开始时间', type: 'month' },
        { key: 'endDate', label: '结束时间', type: 'month' },
        { key: 'description', label: '实践描述', type: 'textarea', wide: true }
      ]
    },
    {
      key: 'languageSkills', title: '语言能力', repeatable: true, itemTitle: '语言', fields: [
        { key: 'language', label: '语言类型', required: true, aliases: ['语言名称'] },
        { key: 'proficiency', label: '掌握程度', type: 'select', options: proficiencyOptions },
        { key: 'listeningSpeaking', label: '听说', type: 'select', options: proficiencyOptions },
        { key: 'readingWriting', label: '读写', type: 'select', options: proficiencyOptions },
        { key: 'certificate', label: '等级 / 证书', aliases: ['英语等级', '其他外语水平'] },
        { key: 'score', label: '等级成绩', aliases: ['英语等级成绩', '考试成绩'] },
        { key: 'description', label: '补充说明' }
      ]
    },
    {
      key: 'certificates', title: '证书与职业资格', repeatable: true, itemTitle: '证书', fields: [
        { key: 'type', label: '证书种类' },
        { key: 'name', label: '证书名称', required: true, aliases: ['职称及职业资格证书', '职业资格证书', '资格证书', '职称'] },
        { key: 'number', label: '证书编号' },
        { key: 'level', label: '证书级别' },
        { key: 'date', label: '获得 / 发证时间', type: 'month', aliases: ['获得时间', '发证日期'] },
        { key: 'issuer', label: '发证机构', aliases: ['颁发单位'] },
        { key: 'description', label: '证书描述', type: 'textarea', wide: true }
      ]
    },
    {
      key: 'awards', title: '奖励与荣誉', repeatable: true, itemTitle: '奖励', fields: [
        { key: 'name', label: '奖项名称', required: true, aliases: ['获奖信息', '奖励情况'] },
        { key: 'level', label: '奖项级别' },
        { key: 'issuer', label: '颁奖单位' },
        { key: 'date', label: '获奖时间', type: 'month' },
        { key: 'description', label: '获奖说明', type: 'textarea', wide: true },
        { key: 'ranking', label: '获奖名次' }
      ]
    },
    {
      key: 'skills', title: '技能', repeatable: true, itemTitle: '技能', fields: [
        { key: 'category', label: '技能类别' },
        { key: 'name', label: '技能名称', required: true, aliases: ['特长'] },
        { key: 'proficiency', label: '掌握程度', type: 'select', options: proficiencyOptions },
        { key: 'description', label: '技能说明' }
      ]
    },
    {
      key: 'publications', title: '论文 / 发表成果', repeatable: true, itemTitle: '论文', fields: [
        { key: 'title', label: '名称', required: true, aliases: ['论文名称'] },
        { key: 'authorOrder', label: '作者顺序' },
        { key: 'publishDate', label: '发布时间', type: 'month' },
        { key: 'journal', label: '所属期刊' },
        { key: 'doi', label: 'DOI / 检索号' },
        { key: 'status', label: '发表状态' },
        { key: 'description', label: '补充内容', type: 'textarea', wide: true }
      ]
    },
    {
      key: 'patents', title: '专利', repeatable: true, itemTitle: '专利', fields: [
        { key: 'name', label: '专利名称', required: true },
        { key: 'number', label: '专利号' },
        { key: 'authorOrder', label: '发明人顺序' },
        { key: 'applicationDate', label: '申请时间', type: 'month' },
        { key: 'authorizationDate', label: '授权时间', type: 'month' },
        { key: 'status', label: '专利状态' },
        { key: 'description', label: '专利说明', type: 'textarea', wide: true }
      ]
    },
    {
      key: 'linksAndSummary', title: '链接与补充介绍', fields: [
        { key: 'portfolio', label: '作品集 / 个人网站', type: 'url', aliases: ['作品集访问链接', '相关作品链接'] },
        { key: 'github', label: 'GitHub', type: 'url' },
        { key: 'linkedin', label: 'LinkedIn', type: 'url' },
        { key: 'gameExperience', label: '游戏经历', type: 'textarea', wide: true },
        { key: 'hobbies', label: '兴趣爱好', type: 'textarea', wide: true },
        { key: 'specialties', label: '特长', type: 'textarea', wide: true },
        { key: 'selfEvaluation', label: '自我评价', type: 'textarea', wide: true, aliases: ['自我描述', '个人优势'] },
        { key: 'otherInformation', label: '其他情况 / 补充内容', type: 'textarea', wide: true, aliases: ['其他', '信息内容'] }
      ]
    },
    {
      key: 'qualifications', title: '常见资格与意愿', description: '不确定或涉及敏感事实时请留空，不设置默认答案。', fields: [
        { key: 'relativesEmployed', label: '是否有亲属在应聘单位任职', type: 'select', options: yesNoOptions },
        { key: 'relativesInIndustry', label: '是否有亲友在同行机构工作', type: 'select', options: yesNoOptions },
        { key: 'hasWorkExperience', label: '是否有工作经历', type: 'select', options: yesNoOptions, aliases: ['没有工作经历'] },
        { key: 'acceptsRelocation', label: '是否接受搬迁', type: 'select', options: yesNoOptions },
        { key: 'acceptsRotation', label: '是否接受轮岗', type: 'select', options: yesNoOptions },
        { key: 'acceptsTravel', label: '是否接受出差', type: 'select', options: yesNoOptions },
        { key: 'workAuthorized', label: '是否具有合法工作资格', type: 'select', options: yesNoOptions },
        { key: 'needsSponsorship', label: '是否需要签证担保', type: 'select', options: yesNoOptions },
        { key: 'isTrainingStudent', label: '是否为招聘方培训学员', type: 'select', options: yesNoOptions, aliases: ['本人是否为快乐学习学员'] },
        { key: 'relativesAreStudents', label: '是否有亲友为招聘方学员', type: 'select', options: yesNoOptions, aliases: ['是否有亲友为快乐学习学员'] }
      ]
    },
    {
      key: 'customAnswers', title: '公司专项回答', repeatable: true, itemTitle: '专项问题', description: '保存不能安全归入公共字段的公司专属问题。', fields: [
        { key: 'company', label: '适用公司 / 范围' },
        { key: 'question', label: '问题原文', wide: true, required: true, aliases: ['信息名称'] },
        { key: 'answer', label: '回答', type: 'textarea', wide: true, aliases: ['信息内容'] },
        { key: 'notes', label: '备注', wide: true }
      ]
    },
    {
      key: 'attachments', title: '附件', description: '附件保存在当前浏览器的本地 IndexedDB，不随 JSON 文本备份导出。', fields: [
        { key: 'idPhoto', label: '证件照', type: 'file', accept: 'image/*' },
        { key: 'resume', label: '简历附件', type: 'file', accept: '.pdf,.doc,.docx,.txt' },
        { key: 'transcripts', label: '本硕博成绩单', type: 'file', accept: '.pdf,image/*', multiple: true, aliases: ['学校盖章承认的本硕博成绩单'] },
        { key: 'englishCertificates', label: '英语等级证书', type: 'file', accept: '.pdf,image/*', multiple: true },
        { key: 'awardCertificates', label: '获奖证书', type: 'file', accept: '.pdf,image/*', multiple: true },
        { key: 'patentCertificates', label: '专利证书', type: 'file', accept: '.pdf,image/*', multiple: true },
        { key: 'otherFiles', label: '其他附件', type: 'file', multiple: true, aliases: ['附件', '其他'] }
      ]
    }
  ];

  const legacyKeyToPath = {
    fullName: 'basic.fullName', englishName: 'basic.englishName', firstName: 'basic.firstName', lastName: 'basic.lastName',
    gender: 'basic.gender', birthDate: 'basic.birthDate', phone: 'basic.phone', phoneCountryRegion: 'basic.phoneCountryRegion', email: 'basic.email', wechat: 'basic.wechat', qq: 'basic.qq',
    countryRegion: 'basic.countryRegion', city: 'basic.city', address: 'basic.address', postalCode: 'basic.postalCode', nativePlace: 'basic.nativePlace',
    householdRegistration: 'basic.householdRegistration', ethnicity: 'basic.ethnicity', politicalStatus: 'basic.politicalStatus', maritalStatus: 'basic.maritalStatus',
    identityDocumentType: 'basic.identityDocumentType', identityDocumentNumber: 'basic.identityDocumentNumber',
    targetRole: 'jobPreferences.applicationPosition', desiredCity: 'jobPreferences.desiredCities', expectedSalary: 'jobPreferences.expectedMonthlySalary',
    yearsExperience: 'jobPreferences.yearsExperience', availableDate: 'jobPreferences.availableDate', jobStatus: 'jobPreferences.jobStatus',
    school: 'educationExperiences[].schoolName', college: 'educationExperiences[].collegeName', major: 'educationExperiences[].major',
    degree: 'educationExperiences[].degree', academicDegree: 'educationExperiences[].academicDegree', educationStartDate: 'educationExperiences[].startDate',
    graduationDate: 'educationExperiences[].endDate', gpa: 'educationExperiences[].gpa', ranking: 'educationExperiences[].ranking', rankingPercent: 'educationExperiences[].rankingPercent', studyMode: 'educationExperiences[].studyMode',
    company: 'workExperiences[].companyName', department: 'workExperiences[].department', currentTitle: 'workExperiences[].jobTitle',
    workStartDate: 'workExperiences[].startDate', workEndDate: 'workExperiences[].endDate', workDescription: 'workExperiences[].description',
    campusPosition: 'campusExperiences[].jobTitle', projectName: 'projectExperiences[].name', projectRole: 'projectExperiences[].role',
    projectStartDate: 'projectExperiences[].startDate', projectEndDate: 'projectExperiences[].endDate', projectDescription: 'projectExperiences[].description',
    languageName: 'languageSkills[].language', englishLevel: 'languageSkills[].certificate', certificateName: 'certificates[].name',
    certificateNumber: 'certificates[].number', awardingOrganization: 'certificates[].issuer', awardName: 'awards[].name', awardLevel: 'awards[].level',
    portfolio: 'linksAndSummary.portfolio', github: 'linksAndSummary.github', linkedin: 'linksAndSummary.linkedin', summary: 'linksAndSummary.selfEvaluation'
  };

  Object.assign(legacyKeyToPath, {
    alternatePhone: 'basic.alternatePhone',
    fertilityStatus: 'basic.fertilityStatus',
    healthStatus: 'basic.healthStatus',
    heightCm: 'basic.heightCm',
    weightKg: 'basic.weightKg',
    identityDocumentExpiry: 'basic.identityDocumentExpiry',
    desiredOccupation: 'jobPreferences.desiredOccupation',
    desiredCities: 'jobPreferences.desiredCities',
    expectedMonthlySalary: 'jobPreferences.expectedMonthlySalary',
    expectedAnnualSalary: 'jobPreferences.expectedAnnualSalary',
    acceptsAdjustment: 'jobPreferences.acceptsAdjustment',
    recruitmentSource: 'jobPreferences.recruitmentSource',
    whyCompany: 'jobPreferences.whyCompany',
    familyName: 'familyMembers[].name',
    familyRelationship: 'familyMembers[].relationship',
    familyPhone: 'familyMembers[].phone',
    familyWorkUnit: 'familyMembers[].workUnit',
    familyJobTitle: 'familyMembers[].jobTitle',
    workType: 'workExperiences[].type',
    campusStartDate: 'campusExperiences[].startDate',
    campusEndDate: 'campusExperiences[].endDate',
    campusDescription: 'campusExperiences[].description',
    practiceName: 'practiceExperiences[].name',
    practiceRole: 'practiceExperiences[].role',
    practiceStartDate: 'practiceExperiences[].startDate',
    practiceEndDate: 'practiceExperiences[].endDate',
    practiceDescription: 'practiceExperiences[].description',
    languageProficiency: 'languageSkills[].proficiency',
    languageCertificate: 'languageSkills[].certificate',
    languageScore: 'languageSkills[].score',
    certificateLevel: 'certificates[].level',
    certificateDate: 'certificates[].date',
    certificateIssuer: 'certificates[].issuer',
    certificateDescription: 'certificates[].description',
    awardDate: 'awards[].date',
    awardDescription: 'awards[].description',
    hobbies: 'linksAndSummary.hobbies',
    specialties: 'linksAndSummary.specialties',
    otherInformation: 'linksAndSummary.otherInformation',
    resumeAttachment: 'attachments.resume',
    otherAttachment: 'attachments.otherFiles'
  });

  const normalizeAlias = (value) => String(value || '')
    .toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/[\s:：*＊/_-]+/g, '');

  const moduleAliases = [
    { section: 'basic', patterns: [/\u4e2a\u4eba\u4fe1\u606f|\u57fa\u672c\u4fe1\u606f|\u57fa\u672c\u8d44\u6599|\u4e2a\u4eba\u8d44\u6599|\u5019\u9009\u4eba/i] },
    { section: 'jobPreferences', patterns: [/\u6c42\u804c\u610f\u5411|\u5e94\u8058\u610f\u5411|\u5c97\u4f4d\u610f\u5411|\u804c\u4f4d\u610f\u5411|job|position/i] },
    { section: 'familyMembers', patterns: [/\u5bb6\u5ead|\u5bb6\u5ead\u60c5\u51b5|\u5bb6\u5ead\u6210\u5458|\u4eb2\u5c5e|\u7d27\u6025\u8054\u7cfb\u4eba|\u8bc1\u660e\u4eba|family|relative|emergency/i] },
    { section: 'educationExperiences', patterns: [/\u6559\u80b2|\u5b66\u4e60|\u5b66\u5386|\u9662\u6821|education|academic|school/i] },
    { section: 'campusExperiences', patterns: [/\u5728\u6821\u804c\u52a1|\u6821\u56ed|\u6821\u5185|\u5b66\u751f\u5e72\u90e8|\u793e\u56e2|campus/i] },
    { section: 'projectExperiences', patterns: [/\u9879\u76ee|\u4efb\u52a1|project/i] },
    { section: 'practiceExperiences', patterns: [/\u793e\u4f1a\u5b9e\u8df5|\u5b9e\u8df5\u7ecf\u5386|practice/i] },
    { section: 'workExperiences', patterns: [/\u5b9e\u4e60|\u5de5\u4f5c|\u804c\u4e1a|\u4efb\u804c|\u5c31\u4e1a|intern|work|employment|experience/i] },
    { section: 'languageSkills', patterns: [/\u8bed\u8a00|\u5916\u8bed|\u82f1\u8bed\u80fd\u529b|language|english/i] },
    { section: 'certificates', patterns: [/\u8bc1\u4e66|\u804c\u4e1a\u8d44\u683c|\u804c\u79f0|certificate|qualification/i] },
    { section: 'awards', patterns: [/\u83b7\u5956|\u5956\u9879|\u5956\u52b1|\u8363\u8a89|award|honou?r/i] },
    { section: 'skills', patterns: [/\u6280\u80fd|\u7279\u957f|skill/i] },
    { section: 'publications', patterns: [/\u8bba\u6587|\u671f\u520a|\u53d1\u8868|publication|paper|journal/i] },
    { section: 'patents', patterns: [/\u4e13\u5229|patent/i] },
    { section: 'attachments', patterns: [/\u4e0a\u4f20\u7b80\u5386|\u7b80\u5386\u9644\u4ef6|\u9644\u4ef6|\u4e0a\u4f20|attachment|upload/i] },
    { section: 'linksAndSummary', patterns: [/\u5176\u4ed6\u4fe1\u606f|\u8865\u5145\u4fe1\u606f|\u81ea\u6211\u8bc4\u4ef7|\u5174\u8da3|\u7231\u597d|\u7279\u957f|summary|other/i] }
  ];

  const moduleFieldOverrides = {
    basic: {
      fullName: 'basic.fullName', englishName: 'basic.englishName', firstName: 'basic.firstName', lastName: 'basic.lastName',
      gender: 'basic.gender', birthDate: 'basic.birthDate', phone: 'basic.phone', phoneCountryRegion: 'basic.phoneCountryRegion', email: 'basic.email', wechat: 'basic.wechat', qq: 'basic.qq',
      countryRegion: 'basic.countryRegion', city: 'basic.city', address: 'basic.address', postalCode: 'basic.postalCode',
      nativePlace: 'basic.nativePlace', householdRegistration: 'basic.householdRegistration', ethnicity: 'basic.ethnicity',
      politicalStatus: 'basic.politicalStatus', maritalStatus: 'basic.maritalStatus', identityDocumentType: 'basic.identityDocumentType',
      identityDocumentNumber: 'basic.identityDocumentNumber'
    },
    jobPreferences: {
      targetRole: 'jobPreferences.applicationPosition', desiredOccupation: 'jobPreferences.desiredOccupation', desiredCity: 'jobPreferences.desiredCities',
      desiredCities: 'jobPreferences.desiredCities', city: 'jobPreferences.desiredCities', expectedSalary: 'jobPreferences.expectedMonthlySalary',
      expectedMonthlySalary: 'jobPreferences.expectedMonthlySalary', expectedAnnualSalary: 'jobPreferences.expectedAnnualSalary',
      yearsExperience: 'jobPreferences.yearsExperience', availableDate: 'jobPreferences.availableDate', jobStatus: 'jobPreferences.jobStatus',
      acceptsAdjustment: 'jobPreferences.acceptsAdjustment', recruitmentSource: 'jobPreferences.recruitmentSource', whyCompany: 'jobPreferences.whyCompany'
    },
    familyMembers: {
      fullName: 'familyMembers[].name', familyName: 'familyMembers[].name', phone: 'familyMembers[].phone', familyPhone: 'familyMembers[].phone',
      familyRelationship: 'familyMembers[].relationship', company: 'familyMembers[].workUnit', familyWorkUnit: 'familyMembers[].workUnit',
      currentTitle: 'familyMembers[].jobTitle', familyJobTitle: 'familyMembers[].jobTitle', city: 'familyMembers[].location'
    },
    educationExperiences: {
      school: 'educationExperiences[].schoolName', college: 'educationExperiences[].collegeName', major: 'educationExperiences[].major',
      degree: 'educationExperiences[].degree', academicDegree: 'educationExperiences[].academicDegree',
      educationStartDate: 'educationExperiences[].startDate', graduationDate: 'educationExperiences[].endDate',
      periodStartDate: 'educationExperiences[].startDate', periodEndDate: 'educationExperiences[].endDate',
      gpa: 'educationExperiences[].gpa', ranking: 'educationExperiences[].ranking', rankingPercent: 'educationExperiences[].rankingPercent', studyMode: 'educationExperiences[].studyMode'
    },
    workExperiences: {
      company: 'workExperiences[].companyName', department: 'workExperiences[].department', currentTitle: 'workExperiences[].jobTitle',
      workStartDate: 'workExperiences[].startDate', workEndDate: 'workExperiences[].endDate',
      periodStartDate: 'workExperiences[].startDate', periodEndDate: 'workExperiences[].endDate',
      workDescription: 'workExperiences[].description', projectDescription: 'workExperiences[].description'
    },
    campusExperiences: {
      company: 'campusExperiences[].organization', projectName: 'campusExperiences[].organization', campusPosition: 'campusExperiences[].jobTitle',
      currentTitle: 'campusExperiences[].jobTitle', workStartDate: 'campusExperiences[].startDate', workEndDate: 'campusExperiences[].endDate',
      periodStartDate: 'campusExperiences[].startDate', periodEndDate: 'campusExperiences[].endDate',
      workDescription: 'campusExperiences[].description', projectDescription: 'campusExperiences[].description', campusDescription: 'campusExperiences[].description'
    },
    projectExperiences: {
      projectName: 'projectExperiences[].name', company: 'projectExperiences[].name', projectRole: 'projectExperiences[].role',
      currentTitle: 'projectExperiences[].role', projectStartDate: 'projectExperiences[].startDate', projectEndDate: 'projectExperiences[].endDate',
      periodStartDate: 'projectExperiences[].startDate', periodEndDate: 'projectExperiences[].endDate',
      projectDescription: 'projectExperiences[].description', workDescription: 'projectExperiences[].description'
    },
    practiceExperiences: {
      projectName: 'practiceExperiences[].name', practiceName: 'practiceExperiences[].name', projectRole: 'practiceExperiences[].role',
      currentTitle: 'practiceExperiences[].role', periodStartDate: 'practiceExperiences[].startDate', periodEndDate: 'practiceExperiences[].endDate',
      projectDescription: 'practiceExperiences[].description', workDescription: 'practiceExperiences[].description'
    },
    languageSkills: {
      languageName: 'languageSkills[].language', englishLevel: 'languageSkills[].certificate', languageCertificate: 'languageSkills[].certificate',
      languageProficiency: 'languageSkills[].proficiency', languageScore: 'languageSkills[].score'
    },
    certificates: {
      certificateName: 'certificates[].name', certificateNumber: 'certificates[].number', certificateLevel: 'certificates[].level',
      certificateDate: 'certificates[].date', periodStartDate: 'certificates[].date', awardingOrganization: 'certificates[].issuer',
      certificateIssuer: 'certificates[].issuer', certificateDescription: 'certificates[].description',
      projectDescription: 'certificates[].description', workDescription: 'certificates[].description'
    },
    awards: {
      awardName: 'awards[].name', awardLevel: 'awards[].level', awardingOrganization: 'awards[].issuer',
      awardDate: 'awards[].date', periodStartDate: 'awards[].date', awardDescription: 'awards[].description',
      projectDescription: 'awards[].description', workDescription: 'awards[].description'
    },
    linksAndSummary: {
      portfolio: 'linksAndSummary.portfolio', github: 'linksAndSummary.github', linkedin: 'linksAndSummary.linkedin',
      summary: 'linksAndSummary.selfEvaluation', hobbies: 'linksAndSummary.hobbies', specialties: 'linksAndSummary.specialties',
      otherInformation: 'linksAndSummary.otherInformation', projectDescription: 'linksAndSummary.otherInformation', workDescription: 'linksAndSummary.otherInformation'
    },
    attachments: {
      resumeAttachment: 'attachments.resume', otherAttachment: 'attachments.otherFiles'
    }
  };

  function moduleSectionForTitle(title) {
    const text = String(title || '');
    const normalized = normalizeAlias(text);
    for (const rule of moduleAliases) {
      if (rule.patterns.some((pattern) => pattern.test(text) || pattern.test(normalized))) return rule.section;
    }
    return '';
  }

  function moduleSectionPrefix(section) {
    const schemaSection = sections.find((item) => item.key === section);
    if (!schemaSection) return '';
    return `${section}${schemaSection.repeatable ? '[]' : ''}`;
  }

  function profilePathInSection(path, section) {
    const prefix = moduleSectionPrefix(section);
    return Boolean(prefix && String(path || '').startsWith(`${prefix}.`));
  }

  const aliasIndex = [];
  for (const section of sections) {
    for (const field of section.fields) {
      const path = `${section.key}${section.repeatable ? '[]' : ''}.${field.key}`;
      for (const alias of [field.label, ...(field.aliases || [])]) {
        aliasIndex.push({ alias, normalized: normalizeAlias(alias), path, section: section.key, field: field.key });
      }
    }
  }

  const patternRules = [
    { pattern: /是否.*(?:亲属|亲友).*(?:应聘|集团|公司|单位).*任职/i, path: 'qualifications.relativesEmployed' },
    { pattern: /是否.*亲友.*(?:同行|教育机构|培训机构).*工作/i, path: 'qualifications.relativesInIndustry' },
    { pattern: /是否.*(?:服从|接受).*(?:调配|调剂)/i, path: 'jobPreferences.acceptsAdjustment' },
    { pattern: /(?:何处|哪里|从哪).*(?:得知|了解).*(?:招聘|职位|公司)/i, path: 'jobPreferences.recruitmentSource' },
    { pattern: /为何.*(?:加入|选择).*(?:本公司|公司)/i, path: 'jobPreferences.whyCompany' },
    { pattern: /(?:作品|作品集).*(?:链接|地址)/i, path: 'linksAndSummary.portfolio' },
    { pattern: /(?:没有|是否有).*工作经历/i, path: 'qualifications.hasWorkExperience' },
    { pattern: /本人是否.*学员/i, path: 'qualifications.isTrainingStudent' },
    { pattern: /是否有亲友.*学员/i, path: 'qualifications.relativesAreStudents' }
  ];

  globalThis.ResumeProfileSchema = {
    schemaVersion: 1,
    storageKey: 'resumeProfileV1',
    sections,
    aliasIndex,
    patternRules,
    legacyKeyToPath,
    moduleAliases,
    moduleFieldOverrides,
    moduleSectionForTitle,
    moduleSectionPrefix,
    profilePathInSection,
    normalizeAlias
  };
})();

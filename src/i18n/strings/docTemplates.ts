/**
 * i18n · 文档模板「正文兜底文案」
 * ------------------------------------------------------------------
 * 这些正文只在 AI 不可用（无 Key / 报错）时作为骨架兜底显示。
 * 仍然需要多语言：中文界面给中文骨架，其他语言给英文骨架。
 *
 * 占位符：{topic} {to} {from}
 */

export interface DocBodies {
  general: string;
  email: {
    greeting: { formal: string; friendly: string; concise: string };
    body: { formal: string; friendly: string; concise: string };
    closing: { formal: string; friendly: string; concise: string };
  };
  report: string;
  meeting: string;
  ppt: string;
  notes: string;
  contract: string;
  resume: string;
  press: string;
  proposal: string;
  weekly: string;
}

export const docBodiesEn: DocBodies = {
  general: `{topic}

1. Overview

This document explores "{topic}" with the aim of providing a thorough analysis.

2. Key content

2.1 Main points
   - Point 1: ________
   - Point 2: ________
   - Point 3: ________

2.2 Details

   Based on the topic, here is the detailed content about "{topic}":

   ________
   ________
   ________

3. Summary

In summary, {topic} is a topic worth exploring in depth. From the analysis above we can conclude:

- ________
- ________

Feel free to reach out if you need more detail.`,
  email: {
    greeting: {
      formal: 'Dear {to},',
      friendly: 'Hi {to},',
      concise: '{to},',
    },
    body: {
      formal: `I am writing to report on "{topic}".

After thorough research and analysis, we have completed the preparation work. The details are as follows:

1. Background and objectives
This work aims to achieve the agreed goals and keep everything on track.

2. Main content
1. Implementation steps have been planned in detail
2. Responsibilities have been assigned
3. Milestones have been defined

3. Expected outcome
This work is expected to deliver significant results.

Please let me know if you have any questions.`,
      friendly: `Great to talk about "{topic}" with you!

I already have some ideas I'd like to share:

We could start from a few angles:
• First, get clear on the exact requirements
• Then put together a detailed plan
• Finally, execute according to plan

I think this should solve it nicely. What do you think? Tell me anytime~`,
      concise: `About "{topic}":

1. Goal: complete the relevant work
2. Approach: execute according to plan
3. Timeline: as soon as possible

Please review.`,
    },
    closing: {
      formal: 'Best regards,\n\n{from}',
      friendly: 'Looking forward to your reply!\n\n{from}',
      concise: '{from}',
    },
  },
  report: `{topic} — Report

1. Project overview
    1.1 Background
    1.2 Objectives
    1.3 Scope

2. Current-state analysis
    2.1 Current situation
    2.2 Issues
    2.3 Root-cause analysis

3. Solution
    3.1 Overall approach
    3.2 Concrete measures
    3.3 Implementation plan

4. Expected results
    4.1 Direct benefits
    4.2 Indirect benefits

5. Risks and mitigation
    5.1 Potential risks
    5.2 Mitigation measures

6. Conclusions and recommendations`,
  meeting: `Meeting minutes: {topic}

Time: Jan 15, 2024, 14:00–16:00
Location: Meeting room A
Attendees: Alice, Bob, Carol

1. Topic
Discussion of matters related to {topic}

2. Discussion
    1. Progress report
       - Done: requirements analysis, solution design
       - In progress: development
       - Not started: testing

    2. Issues
       - Issue 1: insufficient resources
         Resolution: coordinate support from related teams
       - Issue 2: tight schedule
         Resolution: re-prioritize and deliver in batches

    3. Next steps
       - Finish core feature development (this week)
       - Start testing (early next week)
       - Prepare for release (end of next week)

3. Action items
  ☐ Alice: finish feature A (due Jan 18)
  ☐ Bob: coordinate resources (due Jan 17)
  ☐ Carol: prepare test cases (due Jan 19)

4. Next meeting
Time: Jan 22, 14:00
Agenda: progress review`,
  ppt: `PPT structure: {topic}

Slide 1: Cover
  - Title: {topic}
  - Subtitle: Solution briefing
  - Presenter: XXX
  - Date: Jan 2024

Slide 2: Agenda
  1. Background
  2. Current state
  3. Solution
  4. Implementation plan
  5. Expected results
  6. Summary and outlook

Slide 3: Background
  - Industry trends
  - Business needs
  - Project objectives

Slide 4: Current state
  - Current situation
  - Issues
  - Pain points

Slide 5: Solution
  - Overall architecture
  - Core features
  - Technical approach

Slide 6: Implementation plan
  - Phases
  - Milestones
  - Timeline

Slide 7: Expected results
  - Economic benefits
  - Efficiency gains
  - Other value

Slide 8: Summary and outlook
  - Core value
  - Roadmap
  - Q&A`,
  notes: `📚 Study notes: {topic}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Core concepts
  • Definition: {topic} is an important topic
  • Traits: systematic, practical, extensible
  • Application: used across many fields

📝 Key content
  1. Fundamentals
     - Theoretical basis
     - Core ideas
     - Basic assumptions

  2. Key techniques
     - Technique A: principles and application
     - Technique B: strengths and limits
     - Technique C: best practices

  3. How to practice
     - Step 1: set a clear goal
     - Step 2: make a plan
     - Step 3: execute
     - Step 4: review and summarize

💡 Understanding
  • Grasp the core idea, don't get lost in details
  • Practice a lot — connect theory with practice
  • Build a knowledge system for structured thinking

⚠️ Common pitfalls
  1. Reading without practicing
  2. Chasing perfection and never starting
  3. Stopping at the surface

🎯 Next actions
  □ Read related books and material
  □ Complete exercises and assignments
  □ Summarize into notes
  □ Apply it to consolidate knowledge

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 References: textbooks, official docs, high-quality tutorials`,
  contract: `{topic} — Contract

Party A: _________________
Party B: _________________

1. Purpose
To define the rights and obligations of both parties regarding {topic}, the following agreement is made.

2. Term
From ____/__/__ to ____/__/__.

3. Rights and obligations
1. Party A:
   - Provide necessary resources and technical support
   - Pay the agreed amounts on time
   - Provide required background material promptly

2. Party B:
   - Complete the work to the agreed standard and schedule
   - Ensure quality meets industry norms
   - Keep Party A's trade secrets strictly confidential

4. Fees and payment
1. Total contract amount: CNY ____
2. Payment:
   - ____% as advance payment after signing
   - ____% as final payment after acceptance

5. Breach of contract
1. Either party in breach shall pay liquidated damages of ____ CNY.
2. Losses caused by the breach shall be fully compensated.

6. Dispute resolution
Failing negotiation, the dispute shall be submitted to ____ arbitration commission.

7. Miscellaneous
1. This contract is made in duplicate, one for each party, both equally valid.
2. Matters not covered shall be settled by a supplementary agreement.

Party A signature: ________  Party B signature: ________
Date: ____/__/__`,
  resume: `Resume

[Basic information]
Name: ________
Gender: ________
Date of birth: ________
Phone: ________
Email: ________
Target role: {topic}

[Education]
- __/____ — __/____  ____ University  ____ Major  ____ Degree
- Major courses: ________
- GPA: ____ / 4.0

[Work experience]
1. __/____ — __/____  ____ Company  ____ Title
   - Responsible for ________
   - Led ________
   - Result: ________

2. __/____ — __/____  ____ Company  ____ Title
   - Contributed to ________
   - Completed ________
   - Result: ________

[Project experience]
1. Project related to {topic}
   - Description: ________
   - Tech stack: ________
   - My contribution: ________

[Skills]
- Professional: ________
- Languages: ________
- Other: ________

[Certificates and honors]
- ________
- ________

[About me]
I am passionate about the field of {topic}, with a solid foundation and hands-on experience. I am conscientious, collaborative and eager to keep learning. I look forward to growing further in this field.`,
  press: `Press release

Title: {topic}
Subtitle: ________
Release date: ____/__/__

[Lead]
On ____/__/__, an important announcement about {topic} was officially released. The event marks ________ and will have a lasting impact on the industry and society.

[Body]

1. Background
News about {topic} has attracted wide attention recently. After long preparation and planning, the project has finally made a breakthrough.

2. Highlights
1. Main outcome: ________
2. Key figures: ________
3. Scope of impact: ________

3. Reactions
- Industry experts say: ________
- Related organizations: ________
- Public response: ________

4. Outlook
It is understood that the next step is to ________. The parties involved said they will continue to advance ________ and expect further progress in ________.

[Background material]
For more on {topic}, see:
- ________
- ________

[Contact]
Contact: ________
Phone: ________
Email: ________

---
Issued by ________. Please credit the source when republishing.`,
  proposal: `Project proposal: {topic}

1. Overview
    1.1 Name: {topic}
    1.2 Background: with industry and technology evolving, this project aims to solve ________
    1.3 Objectives: through this project, achieve ________

2. Market analysis
    2.1 Industry status: ________
    2.2 Target users: ________
    2.3 Competitive landscape: ________

3. Technical approach
    3.1 Architecture
        - Frontend: ________
        - Backend: ________
        - Database: ________
    3.2 Core features
        1. ________
        2. ________
        3. ________
    3.3 Key challenges and mitigation
        - Challenge 1: ________ → Mitigation: ________
        - Challenge 2: ________ → Mitigation: ________

4. Implementation plan
| Phase | Time | Content | Deliverable |
|-------|------|---------|-------------|
| Phase 1 | Weeks 1–2 | Requirements analysis | Requirements doc |
| Phase 2 | Weeks 3–6 | Development | Feature modules |
| Phase 3 | Weeks 7–8 | Testing and acceptance | Test report |
| Phase 4 | Week 9 | Deployment | Release build |

5. Budget estimate
- Labor: ________ CNY
- Equipment: ________ CNY
- Other: ________ CNY
- Total: ________ CNY

6. Risk assessment
1. Technical risk: ________ (level: high/medium/low)
2. Market risk: ________ (level: high/medium/low)
3. Team risk: ________ (level: high/medium/low)

7. Expected returns
- Direct returns: ________
- Indirect returns: ________
- Social value: ________`,
  weekly: `Weekly / daily report: {topic}

Reported by: ________
Period: ____/__/__ — ____/__/__

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Work completed
1. {topic} related
   - Completed ________
   - Progress: ____%

2. Other work
   - Completed ________
   - Progress: ____%

2. Highlights
- ________
- ________

3. Issues and risks
1. Issue: ________
   - Impact: ________
   - Resolution: ________

2. Risk: ________
   - Level: high/medium/low
   - Mitigation: ________

4. Plan for next week

| Task | Priority | Due | Notes |
|------|----------|-----|-------|
| ________ | High | ____ | ________ |
| ________ | Medium | ____ | ________ |
| ________ | Low | ____ | ________ |

5. Support needed
- Need the ________ team to help with ________
- Need ________ resources

6. Summary
This week we made ________ progress on {topic}. Next week we will continue to advance ________ to ensure we meet the ________ goal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
};

export const docBodiesZh: DocBodies = {
  general: `{topic}

一、概述

本内容围绕"{topic}"展开，旨在提供全面、深入的分析和阐述。

二、核心内容

1. 主要要点
   - 要点一：________
   - 要点二：________
   - 要点三：________

2. 详细说明

   根据主题要求，以下是关于"{topic}"的详细内容：

   ________
   ________
   ________

三、总结

综上所述，{topic}是一个值得深入探讨的话题。通过以上分析，我们可以得出以下结论：

- ________
- ________

如需进一步了解或有其他问题，请随时提出。`,
  email: {
    greeting: {
      formal: '尊敬的{to}：',
      friendly: '{to}，你好！',
      concise: '{to}：',
    },
    body: {
      formal: `关于"{topic}"事宜，现特向您汇报如下：

经过深入研究和分析，我们已完成相关工作的准备。现将具体情况说明如下：

一、项目背景与目标
本次工作旨在达成既定目标，确保各项工作顺利推进。

二、主要内容
1. 详细规划了实施步骤
2. 明确了责任分工
3. 制定了时间节点

三、预期效果
通过本次工作，预计将取得显著成效。

如有任何问题，请随时与我联系。`,
      friendly: `很高兴和你讨论"{topic}"的事情！

我这边已经有了一些想法，想和你分享一下：

首先，我们可以从以下几个方面入手：
• 先了解清楚具体需求
• 然后制定详细的方案
• 最后按计划执行

我觉得这样应该能很好地解决问题。你觉得怎么样？有什么想法随时和我说呀～`,
      concise: `关于"{topic}"：

1. 目标：完成相关工作
2. 方法：按计划执行
3. 时间：尽快完成

请审阅。`,
    },
    closing: {
      formal: '此致\n敬礼\n\n{from}',
      friendly: '期待你的回复！\n\n{from}',
      concise: '{from}',
    },
  },
  report: `《{topic}报告》

一、项目概述
    1.1 项目背景
    1.2 项目目标
    1.3 项目范围

二、现状分析
    2.1 当前情况
    2.2 存在问题
    2.3 原因分析

三、解决方案
    3.1 总体思路
    3.2 具体措施
    3.3 实施计划

四、预期效果
    4.1 直接效益
    4.2 间接效益

五、风险与对策
    5.1 潜在风险
    5.2 应对措施

六、结论与建议`,
  meeting: `会议纪要：{topic}

会议时间：2024年1月15日 14:00-16:00
会议地点：会议室A
参会人员：张三、李四、王五

一、会议主题
讨论{topic}相关事宜

二、会议内容
    1. 项目进展汇报
       - 已完成：需求分析、方案设计
       - 进行中：开发实现
       - 待启动：测试验证

    2. 问题讨论
       - 问题一：资源不足
         解决方案：协调相关部门支持
       - 问题二：时间紧张
         解决方案：调整优先级，分批交付

    3. 下一步计划
       - 完成核心功能开发（本周）
       - 启动测试工作（下周初）
       - 准备上线发布（下周末）

三、待办事项
  ☐ 张三：完成功能A开发（截止：1月18日）
  ☐ 李四：协调资源（截止：1月17日）
  ☐ 王五：准备测试用例（截止：1月19日）

四、下次会议
时间：1月22日 14:00
议题：项目进度复审`,
  ppt: `PPT结构：{topic}

第1页：封面
  - 标题：{topic}
  - 副标题：方案汇报
  - 汇报人：XXX
  - 日期：2024年1月

第2页：目录
  1. 项目背景
  2. 现状分析
  3. 解决方案
  4. 实施计划
  5. 预期效果
  6. 总结展望

第3页：项目背景
  - 行业趋势
  - 业务需求
  - 项目目标

第4页：现状分析
  - 当前情况
  - 存在问题
  - 痛点分析

第5页：解决方案
  - 总体架构
  - 核心功能
  - 技术方案

第6页：实施计划
  - 阶段划分
  - 时间节点
  - 里程碑

第7页：预期效果
  - 经济效益
  - 效率提升
  - 其他价值

第8页：总结展望
  - 核心价值
  - 未来规划
  - Q&A`,
  notes: `📚 学习笔记：{topic}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 核心概念
  • 定义：{topic}是一个重要的知识点
  • 特点：系统性、实用性、可扩展性
  • 应用：广泛应用于各个领域

📝 重点内容
  1. 基础原理
     - 理论基础
     - 核心思想
     - 基本假设

  2. 关键技术
     - 技术A：原理与应用
     - 技术B：优势与局限
     - 技术C：最佳实践

  3. 实践方法
     - 步骤一：明确目标
     - 步骤二：制定计划
     - 步骤三：执行落实
     - 步骤四：复盘总结

💡 理解要点
  • 抓住核心思想，不要纠结细节
  • 多动手实践，理论联系实际
  • 建立知识体系，形成结构化思维

⚠️ 常见误区
  1. 只看不练，眼高手低
  2. 追求完美，迟迟不动
  3. 浅尝辄止，不够深入

🎯 下一步行动
  □ 阅读相关书籍和资料
  □ 完成练习和作业
  □ 总结归纳，形成笔记
  □ 实践应用，巩固知识

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 参考资料：相关教材、官方文档、优质教程`,
  contract: `《{topic}合同》

甲方：_________________
乙方：_________________

一、合同目的
为明确双方权利义务，就{topic}事宜达成如下协议。

二、合同期限
自____年__月__日至____年__月__日止。

三、双方权利与义务
1. 甲方责任：
   - 提供必要的资源和技术支持
   - 按时支付合同约定的款项
   - 及时提供项目所需的基础资料

2. 乙方责任：
   - 按照约定的标准和时间完成工作
   - 保证工作质量符合行业规范
   - 对甲方的商业秘密严格保密

四、费用与支付方式
1. 合同总金额：人民币____元整
2. 支付方式：
   - 合同签订后支付____%作为预付款
   - 项目验收后支付____%作为尾款

五、违约责任
1. 任何一方违反本合同的约定，需向守约方支付违约金____元。
2. 因违约给对方造成损失的，应赔偿全部损失。

六、争议解决
协商不成，提交____仲裁委员会仲裁。

七、其他约定
1. 本合同一式两份，双方各执一份，具有同等法律效力。
2. 未尽事宜，双方协商签订补充协议。

甲方签字：________  乙方签字：________
日期：____年__月__日`,
  resume: `个人简历

【基本信息】
姓名：________
性别：________
出生年月：________
联系电话：________
电子邮箱：________
求职意向：{topic}

【教育背景】
- ____年__月 — ____年__月  ____大学  ____专业  ____学历
- 主修课程：________
- GPA：____/ 4.0

【工作经历】
1. ____年__月 — ____年__月  ____公司  ____职位
   - 负责________
   - 主导________
   - 成果：________

2. ____年__月 — ____年__月  ____公司  ____职位
   - 参与________
   - 完成________
   - 成果：________

【项目经验】
1. {topic}相关项目
   - 项目描述：________
   - 技术栈：________
   - 个人贡献：________

【技能特长】
- 专业技能：________
- 语言能力：________
- 其他技能：________

【证书与荣誉】
- ________
- ________

【自我评价】
本人对{topic}领域充满热情，具备扎实的专业基础和丰富的实践经验。工作认真负责，善于团队协作，乐于学习新知识。期待在相关领域持续发展。`,
  press: `新闻稿

标题：{topic}
副标题：________
发布日期：____年__月__日

【导语】
____年__月__日，关于{topic}的重要消息正式发布。这一事件标志着________，对行业和社会发展具有深远影响。

【正文】

一、背景介绍
近日，关于{topic}的消息引起了广泛关注。据了解，该项目经过长期的筹备和规划，终于在近期取得了突破性进展。

二、核心内容
1. 主要成果：________
2. 关键数据：________
3. 影响范围：________

三、各方反响
- 业内专家表示：________
- 相关机构评价：________
- 公众反应：________

四、未来展望
据悉，下一步将________。相关方面表示，将继续推进________，预计在________方面取得更大进展。

【背景资料】
关于{topic}的更多信息，请参考：
- ________
- ________

【联系方式】
联系人：________
电话：________
邮箱：________

---
本新闻稿由________发布，转载请注明出处。`,
  proposal: `项目方案：{topic}

一、项目概述
    1.1 项目名称：{topic}
    1.2 项目背景：随着行业发展和技术进步，本项目旨在解决________问题
    1.3 项目目标：通过本项目的实施，实现________

二、市场分析
    2.1 行业现状：________
    2.2 目标用户：________
    2.3 竞争分析：________

三、技术方案
    3.1 总体架构
        - 前端：________
        - 后端：________
        - 数据库：________
    3.2 核心功能
        1. ________
        2. ________
        3. ________
    3.3 技术难点与对策
        - 难点1：________ → 对策：________
        - 难点2：________ → 对策：________

四、实施计划
| 阶段 | 时间 | 内容 | 交付物 |
|------|------|------|--------|
| 第一阶段 | 第1-2周 | 需求分析 | 需求文档 |
| 第二阶段 | 第3-6周 | 开发实现 | 功能模块 |
| 第三阶段 | 第7-8周 | 测试验收 | 测试报告 |
| 第四阶段 | 第9周 | 上线部署 | 上线版本 |

五、预算估算
- 人力成本：________元
- 设备采购：________元
- 其他费用：________元
- 合计：________元

六、风险评估
1. 技术风险：________（等级：高/中/低）
2. 市场风险：________（等级：高/中/低）
3. 团队风险：________（等级：高/中/低）

七、预期收益
- 直接收益：________
- 间接收益：________
- 社会效益：________`,
  weekly: `周报/日报：{topic}

汇报人：________
汇报时间：____年__月__日 — ____年__月__日

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

一、本周工作完成情况

1. {topic}相关
   - 完成________
   - 进度：____%

2. 其他工作
   - 完成________
   - 进度：____%

二、工作亮点
- ________
- ________

三、遇到的问题与风险
1. 问题：________
   - 影响：________
   - 解决方案：________

2. 风险：________
   - 等级：高/中/低
   - 应对措施：________

四、下周工作计划

| 任务 | 优先级 | 预计完成时间 | 备注 |
|------|--------|-------------|------|
| ________ | 高 | ____ | ________ |
| ________ | 中 | ____ | ________ |
| ________ | 低 | ____ | ________ |

五、需要支持
- 需要________部门协助________
- 需要________资源支持

六、总结与思考
本周在{topic}方面取得了________进展。下周将继续推进________，确保________目标的达成。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
};

export function getDocBodies(language: string): DocBodies {
  return language === 'zh' ? docBodiesZh : docBodiesEn;
}

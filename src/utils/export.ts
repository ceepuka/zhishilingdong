import { KnowledgeCardData, KnowledgeNode, GeneratedKnowledge, MindMapNode } from '../types';
import { getCurrentStrings } from '../i18n/strings';
import { getStoredLanguage } from '../hooks/useLanguageStore';
import { examTypeLabel, difficultyLabel, factTypeLabel } from './knowledgeLabels';
import { safeFilename, downloadText, triggerDownload } from './clipboard';
import { exportDocx, exportKnowledgeDocx } from './exportDocx';
import { buildKnowledgePdf, buildMarkdownPdf } from './exportPdf';
import { collectKnowledgeFigures, type FigureMap } from './exportFigures';

/**
 * 下载文本文件（保留旧名，向后兼容既有调用点）。
 *
 * 文件名统一经 `safeFilename` 清洗 —— 以前直接拼 `${title}.md`，
 * 标题里出现 `\ / : * ? " < > |` 时浏览器会静默改名或直接下载失败。
 * MIME 统一补 charset，否则 Windows 记事本打开中文 txt 会按本地代码页解码成乱码。
 */
export function downloadFile(content: string, filename: string, type: string) {
  const mime = type.includes('charset') || type.startsWith('text/') === false ? type : `${type};charset=utf-8`;
  downloadText(content, filename, mime);
}

/**
 * 知识脉络是否真的有内容。
 *
 * 判据是"任一子字段非空"，而不是"对象存在" —— 页面上这个区块是**逐条**渲染的，
 * 五个子字段全空时页面上什么都不显示，导出也该一致。
 */
function hasKnowledgeContext(kc: NonNullable<GeneratedKnowledge['knowledgeContext']>): boolean {
  return Boolean(
    (kc.prerequisites && kc.prerequisites.length > 0) ||
    (kc.relatedTopics && kc.relatedTopics.length > 0) ||
    (kc.learningPath && kc.learningPath.length > 0) ||
    (kc.commonConclusions && kc.commonConclusions.length > 0) ||
    (kc.confusables && kc.confusables.length > 0)
  );
}

/**
 * 知识数据 → 三种文本形态。
 *
 * @param figures 已采集的示意图。**不传 = 不含图**（"复制"与 txt / md 出口就是这样：
 *   往剪贴板或纯文本里塞 base64 是灾难）。传了则：
 *   md 出 `![alt](figure:key)` 标记（供 Word 出口按位置嵌图）、
 *   html 直接内联 data URL（单文件 HTML 本来就该自带图）、txt 出一行提示。
 *   页面上的图分四级兜底，其中"关键词检索"是渲染期 hook 的结果、数据里没有，
 *   导出能带上的只有 image / imageData / svg 三条（见 exportFigures.ts）。
 */
export function generateKnowledgeNote(
  data: KnowledgeCardData | GeneratedKnowledge,
  relatedNodes?: KnowledgeNode[],
  figures?: FigureMap
): { txt: string; md: string; html: string } {
  const s = getCurrentStrings();
  const t = s.exportNote;
  const c = s.search.concept;
  const lang = getStoredLanguage();
  const htmlLang = lang === 'zh' ? 'zh-CN' : 'en';
  const dateLocale = lang === 'zh' ? 'zh-CN' : undefined;

  const title = 'title' in data && data.title
    ? data.title
    : ('topic' in data && data.topic) ? (data as GeneratedKnowledge).topic : t.defaultTitle;

  let txtContent = `# ${title}\n\n`;
  let mdContent = `# ${title}\n\n`;
  let htmlContent = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; }
    h1 { color: #1e293b; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    h3 { color: #475569; }
    p { margin: 10px 0; }
    ul, ol { padding-left: 20px; }
    li { margin: 8px 0; }
    .code { background: #f8fafc; padding: 10px; border-radius: 4px; font-family: monospace; }
    .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .timestamp { color: #94a3b8; font-size: 14px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
`;

  htmlContent += `<h1>${title}</h1>\n`;

  // 概览（summary）：页面上它是紧跟标题的引导段，"复制"和"导出"两个出口必须口径一致。
  // 之前只有"复制"带上了它，导出文件里整段丢失 —— 同一份内容两个出口不一致是 bug，不是风格差异。
  if ('summary' in data && data.summary) {
    txtContent += `${data.summary}\n\n`;
    mdContent += `${data.summary}\n\n`;
    htmlContent += `<p>${data.summary}</p>\n`;
  }

  if ('definition' in data && data.definition) {
    txtContent += `## ${t.definition}\n${data.definition}\n\n`;
    mdContent += `## ${t.definition}\n${data.definition}\n\n`;
    htmlContent += `<h2>${t.definition}</h2><p>${data.definition}</p>\n`;
  }

  if ('points' in data && data.points && data.points.length > 0) {
    txtContent += `## ${t.points}\n`;
    mdContent += `## ${t.points}\n`;
    htmlContent += `<h2>${t.points}</h2><ul>\n`;
    data.points.forEach((point, idx) => {
      txtContent += `${idx + 1}. ${point}\n`;
      mdContent += `${idx + 1}. ${point}\n`;
      htmlContent += `<li>${point}</li>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  // **判据必须是 typeof，不能只判非空**：`GeneratedKnowledge.examples` 是对象数组
// （{title, description, steps, result}），旧格式才是字符串数组。
// 这里原先只判 `length > 0`，于是对象数组走到`${example}` 直接被插值成
// "[object Object]"，并且**占住了本该给对象分支的标题**，下方那个对象分支永不执行。
  if ('examples' in data && data.examples && data.examples.length > 0 && typeof data.examples[0] === 'string') {
    txtContent += `## ${t.examples}\n`;
    mdContent += `## ${t.examples}\n`;
    htmlContent += `<h2>${t.examples}</h2>\n`;
    data.examples.forEach((example, idx) => {
      txtContent += `${idx + 1}. ${example}\n`;
      mdContent += `${idx + 1}. ${example}\n`;
      htmlContent += `<h3>${t.exampleN.replace('{n}', String(idx + 1))}</h3><p>${example}</p>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
  }

  if ('concepts' in data && data.concepts && data.concepts.length > 0 && typeof data.concepts[0] === 'string') {
    txtContent += `## ${t.relatedConcepts}\n`;
    mdContent += `## ${t.relatedConcepts}\n`;
    htmlContent += `<h2>${t.relatedConcepts}</h2><ul>\n`;
    data.concepts.forEach((concept) => {
      txtContent += `- ${concept}\n`;
      mdContent += `- ${concept}\n`;
      htmlContent += `<li>${concept}</li>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  if ('concepts' in data && data.concepts && data.concepts.length > 0 && typeof data.concepts[0] !== 'string') {
    txtContent += `## ${t.coreConcepts}\n`;
    mdContent += `## ${t.coreConcepts}\n\n`;
    htmlContent += `<h2>${t.coreConcepts}</h2>\n`;
    // 总述：核心概念区块的引导段（是核心概念的一部分）
    const overview = ('conceptsOverview' in data && data.conceptsOverview) ? String(data.conceptsOverview) : '';
    if (overview) {
      txtContent += `${t.overview}: ${overview}\n\n`;
      mdContent += `**${t.overview}:** ${overview}\n\n`;
      htmlContent += `<p><strong>${t.overview}:</strong> ${overview}</p>\n`;
    }
    (data.concepts as Array<{ type: string; title: string; content: { elementary: string; advanced: string }; notation?: string; example?: string; keyPoints?: string[]; pitfalls?: string[] }>).forEach((concept, ci) => {
      const typeLabel = concept.type === 'definition' ? c.typeDefinition :
                        concept.type === 'formula' ? c.typeFormula :
                        concept.type === 'theorem' ? c.typeTheorem : c.typePrinciple;
      txtContent += `### ${typeLabel}: ${concept.title}\n${t.elementary}: ${concept.content.elementary}\n${t.advanced}: ${concept.content.advanced}\n\n`;
      mdContent += `### ${typeLabel}: ${concept.title}\n**${t.elementary}:** ${concept.content.elementary}\n\n**${t.advanced}:** ${concept.content.advanced}\n\n`;
      htmlContent += `<h3>${typeLabel}: ${concept.title}</h3><p><strong>${t.elementary}:</strong> ${concept.content.elementary}</p><p><strong>${t.advanced}:</strong> ${concept.content.advanced}</p>\n`;

      // 概念示意图：跟着概念标题走，位置与 PDF 出口的图块一致。
      // md 里放的是**标记**而不是 base64 —— md 会被"复制"出口复用，塞 base64 会
      // 把剪贴板撑到几百 KB；Word 出口解析到标记再换成真正的位图。
      const fig = figures?.get(`concept:${ci}`);
      if (fig) {
        const alt = `${concept.title}${c.figureSuffix}`;
        txtContent += `${s.common.exportActions.figureOmitted}\n`;
        mdContent += `![${alt}](figure:concept:${ci})\n\n`;
        htmlContent += `<img src="${fig.dataUrl}" alt="${alt}" style="max-width:100%;height:auto;margin:12px 0"/>\n`;
      }
      if (concept.notation) {
        txtContent += `${t.formula}: ${concept.notation}\n\n`;
        mdContent += `\`\`\`latex\n${concept.notation}\n\`\`\`\n\n`;
        htmlContent += `<div class="code">${concept.notation}</div>\n`;
      }
      // 关键要点
      if (concept.keyPoints && concept.keyPoints.length > 0) {
        txtContent += `${t.keyPoints}:\n`;
        mdContent += `**${t.keyPoints}:**\n`;
        htmlContent += `<p><strong>${t.keyPoints}:</strong></p><ul>\n`;
        concept.keyPoints.forEach((kp) => {
          txtContent += `- ${kp}\n`;
          mdContent += `- ${kp}\n`;
          htmlContent += `<li>${kp}</li>\n`;
        });
        txtContent += '\n';
        mdContent += '\n';
        htmlContent += `</ul>\n`;
      }
      // 易错提醒
      if (concept.pitfalls && concept.pitfalls.length > 0) {
        txtContent += `${t.pitfalls}:\n`;
        mdContent += `**${t.pitfalls}:**\n`;
        htmlContent += `<p><strong>${t.pitfalls}:</strong></p><ul>\n`;
        concept.pitfalls.forEach((p) => {
          txtContent += `- ${p}\n`;
          mdContent += `- ${p}\n`;
          htmlContent += `<li>${p}</li>\n`;
        });
        txtContent += '\n';
        mdContent += '\n';
        htmlContent += `</ul>\n`;
      }
      // 概念示例（可选，独立于定义）
      if (concept.example) {
        txtContent += `${c.example}: ${concept.example}\n\n`;
        mdContent += `**${c.example}:** ${concept.example}\n\n`;
        htmlContent += `<p><strong>${c.example}:</strong> ${concept.example}</p>\n`;
      }
    });
  }

  if ('example' in data && data.example) {
    txtContent += `## ${t.examples}\n${data.example}\n\n`;
    mdContent += `## ${t.examples}\n${data.example}\n\n`;
    htmlContent += `<h2>${t.examples}</h2><p>${data.example}</p>\n`;
  }

  if ('examples' in data && data.examples && data.examples.length > 0 && typeof data.examples[0] !== 'string') {
    txtContent += `## ${t.examples}\n`;
    mdContent += `## ${t.examples}\n\n`;
    htmlContent += `<h2>${t.examples}</h2>\n`;
    (data.examples as Array<{ title: string; description: string; steps?: string[]; result?: string }>).forEach((example, idx) => {
      txtContent += `${idx + 1}. ${example.title}\n${example.description}\n`;
      mdContent += `${idx + 1}. **${example.title}**\n${example.description}\n`;
      htmlContent += `<h3>${t.exampleN.replace('{n}', String(idx + 1))}: ${example.title}</h3><p>${example.description}</p>\n`;
      if (example.steps && example.steps.length > 0) {
        txtContent += `${t.steps}:\n`;
        mdContent += `**${t.steps}:**\n`;
        htmlContent += `<ol>\n`;
        example.steps.forEach((step, stepIdx) => {
          txtContent += `${stepIdx + 1}. ${step}\n`;
          mdContent += `${stepIdx + 1}. ${step}\n`;
          htmlContent += `<li>${step}</li>\n`;
        });
        txtContent += '\n';
        mdContent += '\n';
        htmlContent += `</ol>\n`;
      }
      if (example.result) {
        txtContent += `${t.conclusion}: ${example.result}\n\n`;
        mdContent += `**${t.conclusion}:** ${example.result}\n\n`;
        htmlContent += `<p><strong>${t.conclusion}:</strong> ${example.result}</p>\n`;
      }
    });
  }

  if ('steps' in data && data.steps.length > 0) {
    txtContent += `## ${t.processSteps}\n`;
    mdContent += `## ${t.processSteps}\n`;
    htmlContent += `<h2>${t.processSteps}</h2><ol>\n`;
    data.steps.forEach((step, idx) => {
      txtContent += `${idx + 1}. ${step.name}: ${step.desc}\n`;
      mdContent += `${idx + 1}. **${step.name}**: ${step.desc}\n`;
      htmlContent += `<li><strong>${step.name}</strong>: ${step.desc}</li>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ol>\n`;
  }

  if ('formula' in data) {
    txtContent += `## ${t.formula}\n${data.formula}\n\n`;
    mdContent += `## ${t.formula}\n\\[${data.formula}\\]\n\n`;
    htmlContent += `<h2>${t.formula}</h2><div class="code">${data.formula}</div>\n`;
    if (data.description) {
      txtContent += `## ${t.description}\n${data.description}\n\n`;
      mdContent += `## ${t.description}\n${data.description}\n\n`;
      htmlContent += `<h2>${t.description}</h2><p>${data.description}</p>\n`;
    }
  }

  if ('events' in data && data.events.length > 0) {
    txtContent += `## ${t.timeline}\n`;
    mdContent += `## ${t.timeline}\n`;
    htmlContent += `<h2>${t.timeline}</h2><ul>\n`;
    data.events.forEach((event) => {
      txtContent += `${event.time}: ${event.event}\n`;
      mdContent += `- **${event.time}**: ${event.event}\n`;
      htmlContent += `<li><strong>${event.time}</strong>: ${event.event}</li>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  if ('items' in data && data.items.length > 0) {
    txtContent += `## ${t.comparison}\n`;
    mdContent += `## ${t.comparison}\n\n`;
    htmlContent += `<h2>${t.comparison}</h2><table>\n`;
    if (data.columns) {
      txtContent += `${data.columns.join('\t')}\n`;
      mdContent += `| ${data.columns.join(' | ')} |\n`;
      mdContent += `| ${data.columns.map(() => '---').join(' | ')} |\n`;
      htmlContent += `<thead><tr>${data.columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>\n<tbody>\n`;
    }
    data.items.forEach((item) => {
      if (data.columns) {
        txtContent += `${data.columns.map(col => item[col] || '').join('\t')}\n`;
        mdContent += `| ${data.columns.map(col => item[col] || '').join(' | ')} |\n`;
        htmlContent += `<tr>${data.columns.map(col => `<td>${item[col] || ''}</td>`).join('')}</tr>\n`;
      }
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</tbody></table>\n`;
  }

  if ('tree' in data && data.tree.length > 0) {
    txtContent += `## ${t.hierarchy}\n`;
    mdContent += `## ${t.hierarchy}\n\n`;
    htmlContent += `<h2>${t.hierarchy}</h2><ul>\n`;
    const renderTree = (nodes: typeof data.tree, indent: number = 0) => {
      nodes.forEach((node) => {
        const prefix = '  '.repeat(indent);
        txtContent += `${prefix}${node.name}\n`;
        mdContent += `${prefix}- ${node.name}\n`;
        if (indent === 0) {
          htmlContent += `<li><strong>${node.name}</strong>`;
        } else {
          htmlContent += `<li>${node.name}`;
        }
        if (node.children && node.children.length > 0) {
          htmlContent += `<ul>\n`;
          renderTree(node.children, indent + 1);
          htmlContent += `</ul>`;
        }
        htmlContent += `</li>\n`;
      });
    };
    renderTree(data.tree);
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  if ('mindMap' in data && data.mindMap && data.mindMap.length > 0) {
    txtContent += `## ${t.mindMap}\n`;
    mdContent += `## ${t.mindMap}\n\n`;
    htmlContent += `<h2>${t.mindMap}</h2><ul>\n`;
    const renderMindMap = (nodes: typeof data.mindMap, indent: number = 0) => {
      nodes.forEach((node) => {
        const prefix = '  '.repeat(indent);
        txtContent += `${prefix}${node.title}\n`;
        mdContent += `${prefix}- ${node.title}\n`;
        htmlContent += `<li>${node.title}`;
        if (node.children && node.children.length > 0) {
          htmlContent += `<ul>\n`;
          renderMindMap(node.children, indent + 1);
          htmlContent += `</ul>`;
        }
        htmlContent += `</li>\n`;
      });
    };
    renderMindMap(data.mindMap);
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  // ==========================================================================
  // 以下三段（知识脉络 / 试题 / 趣味知识）是 GeneratedKnowledge 的核心区块，
  // 页面上都在渲染（见 components/knowledge/KnowledgeContentView），
  // 但**本函数此前完全没有对应分支** —— 于是搜索结果导出后这三段整段消失，
  // 而"复制"出口（SearchResults.handleCopy 手写的那份）却有。
  // 同一份内容两个出口不一致，参见 docs/issues.md 里 summary 那条同类记录。
  // 三格式必须同步补齐，缺一种就又是一次口径漂移。
  // ==========================================================================

  // **必须判"整段非空"再出标题**：只判 `'knowledgeContext' in data` 的话，
  // 空结构（三个数组都是空的）也会产出一个光秃秃的"## 知识脉络"标题 ——
  // 页面上这个区块根本不渲染，导出文件里却有，属于凭空多出的内容。
  if ('knowledgeContext' in data && data.knowledgeContext && hasKnowledgeContext(data.knowledgeContext)) {
    const kc = data.knowledgeContext;
    const secLabel = s.search.sections.knowledgeContext;
    txtContent += `## ${secLabel}\n\n`;
    mdContent += `## ${secLabel}\n\n`;
    htmlContent += `<h2>${secLabel}</h2>\n<ul>\n`;

    if (kc.prerequisites && kc.prerequisites.length > 0) {
      txtContent += `${s.search.context.prerequisites}: ${kc.prerequisites.join('、')}\n`;
      mdContent += `- **${s.search.context.prerequisites}:** ${kc.prerequisites.join('、')}\n`;
      htmlContent += `<li><strong>${s.search.context.prerequisites}:</strong> ${kc.prerequisites.join('、')}</li>\n`;
    }
    if (kc.relatedTopics && kc.relatedTopics.length > 0) {
      txtContent += `${s.search.context.relatedTopics}: ${kc.relatedTopics.join('、')}\n`;
      mdContent += `- **${s.search.context.relatedTopics}:** ${kc.relatedTopics.join('、')}\n`;
      htmlContent += `<li><strong>${s.search.context.relatedTopics}:</strong> ${kc.relatedTopics.join('、')}</li>\n`;
    }
    // 编号型子列表（学习路径 / 常用结论）用 1. 2. 3. 逐条写出，不用顿号挤一行 ——
    // 挤成一行后项数一多就完全读不出层次
    if (kc.learningPath && kc.learningPath.length > 0) {
      txtContent += `\n${s.search.context.learningPath}:\n`;
      mdContent += `\n**${s.search.context.learningPath}:**\n`;
      htmlContent += `</ul>\n<p><strong>${s.search.context.learningPath}:</strong></p>\n<ol>\n`;
      kc.learningPath.forEach((step, i) => {
        txtContent += `${i + 1}. ${step}\n`;
        mdContent += `${i + 1}. ${step}\n`;
        htmlContent += `<li>${step}</li>\n`;
      });
    }
    if (kc.commonConclusions && kc.commonConclusions.length > 0) {
      txtContent += `\n${s.search.context.conclusions}:\n`;
      mdContent += `\n**${s.search.context.conclusions}:**\n`;
      htmlContent += `${kc.learningPath && kc.learningPath.length > 0 ? '</ol>\n' : ''}<p><strong>${s.search.context.conclusions}:</strong></p>\n<ol>\n`;
      kc.commonConclusions.forEach((item, i) => {
        txtContent += `${i + 1}. ${item}\n`;
        mdContent += `${i + 1}. ${item}\n`;
        htmlContent += `<li>${item}</li>\n`;
      });
    }
    if (kc.confusables && kc.confusables.length > 0) {
      txtContent += `\n${s.search.context.distinctions}:\n`;
      mdContent += `\n**${s.search.context.distinctions}:**\n`;
      htmlContent += `${kc.learningPath && kc.learningPath.length > 0 || kc.commonConclusions && kc.commonConclusions.length > 0 ? '</ol>\n' : ''}<p><strong>${s.search.context.distinctions}:</strong></p>\n<ul>\n`;
      kc.confusables.forEach((cf) => {
        txtContent += `- ${cf.topic}: ${cf.difference}\n`;
        mdContent += `- **${cf.topic}:** ${cf.difference}\n`;
        htmlContent += `<li><strong>${cf.topic}:</strong> ${cf.difference}</li>\n`;
      });
    }
    htmlContent += `</ul>\n`;
    txtContent += '\n';
    mdContent += '\n';
  }

  // 试题（含题型、选项、答案、解析、难度、出处）
  if ('examQuestions' in data && data.examQuestions && data.examQuestions.length > 0) {
    const secLabel = s.search.sections.examQuestions;
    txtContent += `## ${secLabel}\n\n`;
    mdContent += `## ${secLabel}\n\n`;
    htmlContent += `<h2>${secLabel}</h2>\n`;
    data.examQuestions.forEach((q, qi) => {
      const typeLabel = examTypeLabel(s, q.type);
      const difficulty = difficultyLabel(s, q.difficulty);
      const source = q.source
        ? `${q.source.year} ${q.source.exam}${q.source.section ? ` ${q.source.section}` : ''}`
        : '';

      txtContent += `### [${typeLabel}][${difficulty}] ${q.question}\n`;
      mdContent += `### [${typeLabel}][${difficulty}] ${q.question}\n\n`;
      htmlContent += `<h3><span class="highlight">[${typeLabel}][${difficulty}]</span> ${q.question}</h3>\n`;

      if (q.options && q.options.length > 0) {
        txtContent += '\n';
        mdContent += '\n';
        htmlContent += '<ul>\n';
        q.options.forEach((opt, oi) => {
          // 选项字母用 ASCII A/B/C/D：与页面上渲染一致，也避免不同系统字体差异
          const letter = String.fromCharCode(65 + oi);
          txtContent += `${letter}. ${opt}\n`;
          mdContent += `${letter}. ${opt}\n`;
          htmlContent += `<li><strong>${letter}.</strong> ${opt}</li>\n`;
        });
        txtContent += '\n';
        mdContent += '\n';
        htmlContent += '</ul>\n';
      }

      // 试题配图：能拿到字节就出真图；拿不到（远程图被跨域挡住 / 图只在渲染期
      // 检索到）才退回提示行 —— "如图"型试题缺图就是道废题，宁可多说一句，
      // 也不能让用户去答一道看不见图的几何题。
      const fig = figures?.get(`question:${qi}`);
      if (fig) {
        txtContent += `${s.common.exportActions.figureOmitted}\n`;
        mdContent += `![${typeLabel}](figure:question:${qi})\n\n`;
        htmlContent += `<img src="${fig.dataUrl}" alt="${typeLabel}" style="max-width:100%;height:auto;margin:12px 0"/>\n`;
      } else if (q.image || q.imageData || q.svg) {
        const figureNote = s.common.exportActions.figureOmitted;
        txtContent += `${figureNote}\n`;
        mdContent += `> ${figureNote}\n`;
        htmlContent += `<p><em>${figureNote}</em></p>\n`;
      }

      txtContent += `${s.search.actions.answer}${q.answer}\n${s.search.actions.explanation}${q.explanation}\n`;
      mdContent += `**${s.search.actions.answer}** ${q.answer}\n\n**${s.search.actions.explanation}** ${q.explanation}\n`;
      htmlContent += `<p><strong>${s.search.actions.answer}</strong> ${q.answer}</p><p><strong>${s.search.actions.explanation}</strong> ${q.explanation}</p>\n`;

      if (source) {
        txtContent += `(${source})\n`;
        mdContent += `(${source})\n`;
        htmlContent += `<p style="color:#94a3b8;font-size:14px">(${source})</p>\n`;
      }
      txtContent += '\n';
      mdContent += '\n';
      htmlContent += '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />\n';
      void qi;
    });
  }

  // 趣味知识
  if ('interestingFacts' in data && data.interestingFacts && data.interestingFacts.length > 0) {
    const secLabel = s.search.sections.interestingFacts;
    txtContent += `## ${secLabel}\n\n`;
    mdContent += `## ${secLabel}\n\n`;
    htmlContent += `<h2>${secLabel}</h2>\n`;
    data.interestingFacts.forEach((f) => {
      const typeLabel = factTypeLabel(s, f.type);
      txtContent += `### ${f.title}\n${f.content}\n\n`;
      mdContent += `### ${f.title}\n${f.content}\n\n`;
      htmlContent += `<h3><span class="highlight">${typeLabel}</span> ${f.title}</h3><p>${f.content}</p>\n`;
    });
  }

  if (relatedNodes && relatedNodes.length > 0) {
    mdContent += `## ${t.relatedTopics}\n\n`;
    htmlContent += `<h2>${t.relatedTopics}</h2><ul>\n`;
    relatedNodes.forEach((node) => {
      txtContent += `- ${node.title}\n`;
      mdContent += `- [${node.title}](#)\n`;
      htmlContent += `<li>${node.title}</li>\n`;
    });
    txtContent += '\n';
    mdContent += '\n';
    htmlContent += `</ul>\n`;
  }

  const timestamp = new Date().toLocaleString(dateLocale);
  txtContent += `---\n${t.exportedAt}: ${timestamp}\n${t.source}: ${s.app.brand}`;
  mdContent += `---\n*${t.exportedAt}: ${timestamp} | ${t.source}: ${s.app.brand}*`;
  htmlContent += `<div class="timestamp">${t.exportedAt}: ${timestamp} | ${t.source}: ${s.app.brand}</div>\n</body></html>`;

  return { txt: txtContent, md: mdContent, html: htmlContent };
}

/** 所有导出格式的统一类型（docx / pdf 由这两个函数额外处理） */
export type NoteExportFormat = 'txt' | 'md' | 'html' | 'docx' | 'pdf';

/**
 * 导出知识笔记。
 *
 * **async 的原因**：`docx` 走 JSZip 异步生成 Blob。调用方必须 await，
 * 组件里的 `exporting` loading 态正好覆盖这段窗口。
 */
export async function exportKnowledgeNote(
  data: KnowledgeCardData | GeneratedKnowledge,
  format: NoteExportFormat,
  relatedNodes?: KnowledgeNode[]
): Promise<void> {
  const s = getCurrentStrings();
  const title = ('title' in data && data.title)
    ? data.title
    : ('topic' in data && data.topic) ? (data as GeneratedKnowledge).topic : s.exportNote.defaultTitle;
  const base = safeFilename(title, s.exportNote.defaultTitle);

  /**
   * 示意图只在**带图义的三个出口**采集一次，三个出口共用同一份。
   *
   * - txt / md 不采集：往纯文本里塞 base64 是灾难，往 md 里塞
   *   `figure:concept:0` 标记又会跟着"复制"出口进剪贴板。
   * - **一次采集给三个出口用**（而不是各采各的）：同一份内容在 html 和 Word 里
   *   的图必须完全相同，各采一次就可能因为一次成功一次失败而漂移。
   * - 采集不会抛（单张图失败只是少一张，见 exportFigures），所以导出不会
   *   因为某张图拿不到而整份失败。
   */
  const needsFigures = format === 'docx' || format === 'html' || format === 'pdf';
  const figures = needsFigures ? await collectKnowledgeFigures(data) : undefined;

  const { txt, md, html } = generateKnowledgeNote(data, relatedNodes, figures);

  switch (format) {
    case 'md':
      downloadText(md, `${base}.md`, 'text/markdown;charset=utf-8');
      return;
    case 'html':
      downloadText(html, `${base}.html`, 'text/html;charset=utf-8');
      return;
    case 'docx':
      await exportKnowledgeDocx(
        md,
        title,
        'mindMap' in data ? (data.mindMap as MindMapNode[]) : undefined,
        s.exportNote.defaultTitle,
        figures
      );
      return;
    case 'pdf':
      triggerDownload(
        // 第二参是 canvas 工厂（传 undefined 用生产实现）—— 排版是同步的，
        // 图片已经在上面采集完，这里直接喂进去。
        new Blob([buildKnowledgePdf(data, undefined, figures).slice().buffer as ArrayBuffer], {
          type: 'application/pdf',
        }),
        `${base}.pdf`
      );
      return;
    default:
      downloadText(txt, `${base}.txt`, 'text/plain;charset=utf-8');
  }
}

/** 文档导出格式（与笔记同类型集合，这里只是别名让类型可读） */
export type DocumentExportFormat = NoteExportFormat;

/**
 * 导出 AI 生成的文档。
 *
 * 与 `exportKnowledgeNote` 的区别：内容是 AI 写的 **Markdown 原文**，
 * 不是结构化知识数据 —— 所以 docx 直接吃这份 Markdown（`exportDocx` 自带解析）。
 *
 * PDF 走 PDF 生成器（`buildMarkdownPdf`）而不是浏览器打印：打印对话框会把页面
 * 栅格化，产出的是**位图 PDF**，选中后剪贴板为空 —— 用户实测反馈过这一点。
 * 代价是 PDF 不保留 Markdown 标记（`##` / `**`），因为 PDF 是排版产物；
 * 需要原样保留标记就导出 .md。
 */
export async function exportDocument(
  content: string,
  title: string,
  format: DocumentExportFormat
): Promise<void> {
  const s = getCurrentStrings();
  const lang = getStoredLanguage();
  const htmlLang = lang === 'zh' ? 'zh-CN' : 'en';
  const dateLocale = lang === 'zh' ? 'zh-CN' : undefined;
  const base = safeFilename(title, s.favorites.typeDocument);

  if (format === 'docx') {
    await exportDocx(content, title, s.favorites.typeDocument);
    return;
  }

  if (format === 'pdf') {
    triggerDownload(
      new Blob([buildMarkdownPdf(content, title).slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
      `${base}.pdf`
    );
    return;
  }

  if (format === 'html') {
    downloadText(buildDocumentHtml(content, title, htmlLang, dateLocale), `${base}.html`, 'text/html;charset=utf-8');
    return;
  }

  if (format === 'md') {
    downloadText(content, `${base}.md`, 'text/markdown;charset=utf-8');
    return;
  }

  downloadText(content, `${base}.txt`, 'text/plain;charset=utf-8');
}
/** 文档导出用的 HTML 模板（HTML 与 PDF 共用，所以单独抽出来） */
function buildDocumentHtml(content: string, title: string, htmlLang: string, dateLocale?: string): string {
  const s = getCurrentStrings();
  // Markdown 源码直接塞进 <pre>：与旧实现一致的"保真"口径 ——
  // AI 写出的 `#` / `**` / 表格是用户自己产出的内容，不该在导出时被改写。
  // 想在 PDF 里得到排版后的效果，docx 那条路才是正解。
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; white-space: pre-wrap; }
    h1 { text-align: center; color: #1e293b; }
    .timestamp { color: #94a3b8; font-size: 14px; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${escapeHtml(content)}
<div class="timestamp">${escapeHtml(s.exportNote.exportedAt)}: ${new Date().toLocaleString(dateLocale)}</div>
</body>
</html>`;
}

/** 插进 HTML 的动态文本必须转义：标题里带 `<` 会让整个文档结构坏掉 */
function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

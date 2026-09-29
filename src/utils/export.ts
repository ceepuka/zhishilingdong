import { KnowledgeCardData, KnowledgeNode, GeneratedKnowledge } from '../types';
import jsPDF from 'jspdf';
import { getCurrentStrings } from '../i18n/strings';
import { getStoredLanguage } from '../hooks/useLanguageStore';

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateKnowledgeNote(data: KnowledgeCardData | GeneratedKnowledge, relatedNodes?: KnowledgeNode[]): { txt: string; md: string; html: string } {
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

  if ('examples' in data && data.examples && data.examples.length > 0) {
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
    (data.concepts as Array<{ type: string; title: string; content: { elementary: string; advanced: string }; notation?: string; example?: string; keyPoints?: string[]; pitfalls?: string[] }>).forEach((concept) => {
      const typeLabel = concept.type === 'definition' ? c.typeDefinition :
                        concept.type === 'formula' ? c.typeFormula :
                        concept.type === 'theorem' ? c.typeTheorem : c.typePrinciple;
      txtContent += `### ${typeLabel}: ${concept.title}\n${t.elementary}: ${concept.content.elementary}\n${t.advanced}: ${concept.content.advanced}\n\n`;
      mdContent += `### ${typeLabel}: ${concept.title}\n**${t.elementary}:** ${concept.content.elementary}\n\n**${t.advanced}:** ${concept.content.advanced}\n\n`;
      htmlContent += `<h3>${typeLabel}: ${concept.title}</h3><p><strong>${t.elementary}:</strong> ${concept.content.elementary}</p><p><strong>${t.advanced}:</strong> ${concept.content.advanced}</p>\n`;
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

  if (relatedNodes && relatedNodes.length > 0) {
    txtContent += `## ${t.relatedTopics}\n`;
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

export function exportKnowledgeNote(data: KnowledgeCardData | GeneratedKnowledge, format: 'txt' | 'md' | 'html', relatedNodes?: KnowledgeNode[]) {
  const s = getCurrentStrings();
  const { txt, md, html } = generateKnowledgeNote(data, relatedNodes);
  const title = ('title' in data && data.title)
    ? data.title
    : ('topic' in data && data.topic) ? (data as GeneratedKnowledge).topic : s.exportNote.defaultTitle;
  const filename = `${title}.${format}`;

  let content: string;
  let mimeType: string;

  switch (format) {
    case 'md':
      content = md;
      mimeType = 'text/markdown';
      break;
    case 'html':
      content = html;
      mimeType = 'text/html';
      break;
    default:
      content = txt;
      mimeType = 'text/plain';
  }

  downloadFile(content, filename, mimeType);
}

export function exportDocument(content: string, title: string, format: 'txt' | 'md' | 'html' | 'pdf') {
  const s = getCurrentStrings();
  const lang = getStoredLanguage();
  const htmlLang = lang === 'zh' ? 'zh-CN' : 'en';
  const dateLocale = lang === 'zh' ? 'zh-CN' : undefined;
  const filename = `${title}.${format}`;

  if (format === 'pdf') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 7;
    let y = margin + 20;

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(title, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * lineHeight + 15;

    doc.setFontSize(11);
    const contentLines = doc.splitTextToSize(content, maxWidth);

    for (let i = 0; i < contentLines.length; i++) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(contentLines[i], margin, y);
      y += lineHeight;
    }

    doc.save(filename);
    return;
  }

  let mimeType: string;
  switch (format) {
    case 'md':
      mimeType = 'text/markdown';
      break;
    case 'html':
      const htmlContent = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; white-space: pre-wrap; }
    h1 { text-align: center; color: #1e293b; }
    .timestamp { color: #94a3b8; font-size: 14px; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
<h1>${title}</h1>
${content}
<div class="timestamp">${s.exportNote.exportedAt}: ${new Date().toLocaleString(dateLocale)}</div>
</body>
</html>`;
      downloadFile(htmlContent, filename, 'text/html');
      return;
    default:
      mimeType = 'text/plain';
  }

  downloadFile(content, filename, mimeType);
}

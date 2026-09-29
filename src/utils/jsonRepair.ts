/**
 * JSON 响应修复工具（4 层策略）
 * ------------------------------------------------------------------
 * 职责：修复 AI 生成的"脏 JSON"，提升解析成功率
 *   1. cleanJSONText:         字符级清洗（中文引号/全角标点/非法转义/BOM/零宽）
 *   2. 移除尾随逗号
 *   3. repairTruncatedJSON:   最多 10 次迭代式截断+补括号
 *   4. 诊断日志输出（parseJSONResponse 内部）
 */

// 合法的JSON字符串转义字符（反斜杠后必须跟这些字符之一）
const VALID_JSON_ESCAPE = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

// 全角/中文标点 → JSON标准ASCII标点映射表（仅用于字符串外结构部分）
const FULLWIDTH_PUNCT_MAP: Record<string, string> = {
  '\uFF0C': ',',  // ，全角逗号
  '\u3001': ',',  // 、顿号
  '\uFF1A': ':',  // ：全角冒号
  '\uFF5B': '{',  // ｛全角左花括号
  '\uFF5D': '}',  // ｝全角右花括号
  '\uFF3B': '[',  // ［全角左方括号
  '\uFF3D': ']',  // ］全角右方括号
  '\uFF3C': '\\', // ＼全角反斜杠
};

function isHexChar(ch: string): boolean {
  return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

export function cleanJSONText(text: string): string {
  let cleaned = text;

  // 第一步：全局替换中文引号为英文引号
  cleaned = cleaned.replace(/[\u201c\u201d\u201e\u201f\u300c\u300d\u300e\u300f\uFF02]/g, '"');
  cleaned = cleaned.replace(/[\u2018\u2019\u201b]/g, "'");
  cleaned = cleaned.replace(/\u3000/g, ' ');
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  cleaned = cleaned.replace(/[\u2028\u2029]/g, '\\n');

  // 第二步：识别所有字符串内容并修复非法转义，保护到数组
  const strings: string[] = [];
  let inString = false;
  let escape = false;
  let currentStr = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      if (inString) {
        if (ch === 'u') {
          let valid = true;
          for (let j = 1; j <= 4; j++) {
            if (i + j >= cleaned.length || !isHexChar(cleaned[i + j])) { valid = false; break; }
          }
          if (valid) {
            currentStr += ch;
            for (let j = 1; j <= 4; j++) { currentStr += cleaned[i + j]; }
            i += 4;
            escape = false;
            continue;
          } else {
            currentStr += '\\';
            currentStr += ch;
            escape = false;
            continue;
          }
        }
        if (VALID_JSON_ESCAPE.has(ch)) {
          currentStr += ch;
          escape = false;
          continue;
        } else {
          currentStr += '\\';
          currentStr += ch;
          escape = false;
          continue;
        }
      } else {
        currentStr += ch;
        escape = false;
        continue;
      }
    }
    if (ch === '\\') {
      currentStr += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        currentStr = '"';
        inString = true;
      } else {
        currentStr += '"';
        strings.push(currentStr);
        currentStr = '';
        inString = false;
      }
      continue;
    }
    if (inString) {
      if (ch === '\n') { currentStr += '\\n'; continue; }
      if (ch === '\r') { continue; }
      if (ch === '\t') { currentStr += '\\t'; continue; }
      currentStr += ch;
    }
  }

  // 第三步：重建JSON，字符串外部分替换全角标点+清理控制字符
  let result = '';
  let strIdx = 0;
  inString = false;
  escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += strings[strIdx] || '""';
        strIdx++;
      } else {
        inString = false;
      }
      continue;
    }
    if (!inString) {
      const mapped = FULLWIDTH_PUNCT_MAP[ch];
      if (mapped) { result += mapped; continue; }
      const code = ch.charCodeAt(0);
      if (code < 32 && ch !== '\n' && ch !== '\r' && ch !== '\t') continue;
      result += ch;
    }
  }

  return result;
}

export function repairTruncatedJSON(text: string): string | null {
  let repaired = text.trim();

  // 第一步：关闭未闭合的字符串
  let inString = false;
  let escape = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') inString = !inString;
  }
  if (inString) repaired += '"';

  // 第二步：最多 10 次智能截断
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    attempt++;

    let testStr = repaired;
    let openBraces = 0;
    let openBrackets = 0;
    let inStr = false;
    let esc = false;

    for (let i = 0; i < testStr.length; i++) {
      const ch = testStr[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
    }

    const closers: string[] = [];
    for (let i = 0; i < openBrackets; i++) closers.push(']');
    for (let i = 0; i < openBraces; i++) closers.push('}');
    const closed = testStr + closers.join('');

    try {
      JSON.parse(closed);
      return closed;
    } catch {
      // 继续尝试截断
    }

    let cutPos = -1;
    inStr = false;
    esc = false;

    for (let i = repaired.length - 1; i >= 0; i--) {
      const ch = repaired[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === ',' && cutPos === -1) {
        cutPos = i;
        break;
      }
    }

    if (cutPos > 0 && cutPos < repaired.length - 1) {
      repaired = repaired.slice(0, cutPos);
    } else {
      if (repaired.length > 20) {
        repaired = repaired.slice(0, -20);
      } else {
        break;
      }
    }
  }

  // 兜底补括号
  let openBraces = 0;
  let openBrackets = 0;
  let inStr2 = false;
  let esc2 = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (esc2) { esc2 = false; continue; }
    if (ch === '\\') { esc2 = true; continue; }
    if (ch === '"') inStr2 = !inStr2;
    if (inStr2) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }
  for (let i = 0; i < openBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces; i++) repaired += '}';

  return repaired;
}

export function parseJSONResponse<T>(responseText: string): T | null {
  const trimmed = responseText.trim();

  let jsonText = trimmed;
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1].trim();
  } else {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  jsonText = cleanJSONText(jsonText);

  // 尝试 1：直接解析
  try { return JSON.parse(jsonText) as T; } catch { /* fallthrough */ }

  // 尝试 2：移除尾随逗号
  let noTrailingCommas = jsonText;
  let prev = '';
  do {
    prev = noTrailingCommas;
    noTrailingCommas = noTrailingCommas.replace(/,\s*([}\]])/g, '$1');
  } while (noTrailingCommas !== prev);
  if (noTrailingCommas !== jsonText) {
    try { return JSON.parse(noTrailingCommas) as T; } catch { /* fallthrough */ }
  }

  // 尝试 3：补全截断
  try {
    const repaired = repairTruncatedJSON(noTrailingCommas);
    if (repaired) {
      return JSON.parse(repaired) as T;
    }
  } catch { /* fallthrough */ }

  // 全部失败：诊断
  let firstErrMsg = 'unknown';
  try { JSON.parse(jsonText); } catch (e: any) { firstErrMsg = e?.message || String(e); }
  console.warn(
    'JSON parse failed.',
    'Length:', jsonText.length,
    'Error:', firstErrMsg,
    'First 600 chars:', jsonText.slice(0, 600),
    'Last 300 chars:', jsonText.slice(-300)
  );
  return null;
}

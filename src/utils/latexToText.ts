/**
 * LaTeX → 纯文本的可读化降级。
 *
 * **为什么要单独一个模块**：docx 导出与 PDF 导出都要用它，
 * 两边各写一份就会漂移（此前 docx 里就有一份、PDF 里没有，
 * 结果 PDF 里露出 `$i$` 这种原始标记）。
 *
 * PDF 与 Word 都画不了真公式（要图片或 OMML，成本远大于收益），
 * 所以公式以**可读的纯文本**出现：`\frac{a}{b}` → `(a)/(b)`。
 *
 * ## 三个输入通道（v1.8.1 才补全，漏一个用户就会看到 LaTeX 源码）
 *
 *  1. **围符内**：`$...$` / `$$...$$` / `\(...\)` / `\[...\]`。
 *  2. **围栏块**：` ```latex ... ``` `。`utils/export.ts` 自己就会把
 *     `concept.notation` 写成这种块，而 `parseMarkdown`（两个导出通道各一份）
 *     会把行 join 成一段，围栏因此和正文混在一行里 —— 认不出就整段漏过。
 *  3. **裸 LaTeX**：提示词明确要求 `notation` 字段"纯 LaTeX 表达式，不加任何围符"，
 *     正文里模型也常写 `i \times i=-1`。这两处**一个围符都没有**，
 *     只处理围符 = 公式原样漏到用户眼前（用户反馈的"公式没渲染"就是这个）。
 *
 * 第 3 条刻意只做**命令级**降级（带花括号的参数化命令 + 数学命令白名单 +
 * `^{}`/`_{}`），不做全量的花括号→圆括号、也不做裸 `_x`→下标：
 * 正文不是公式，`snake_case`、`C:\Users`、JSON 花括号都可能出现，
 * 全文当公式处理会吃坏散文。确认"整段就是公式"的输入（notation / 围栏 / 围符内）
 * 才走全量 `readableLatex`。
 */

/** 命令名 → 可读 Unicode 符号的映射表。 */
const COMMAND_MAP: Record<string, string> = {
  // 关系 / 比较
  leq: '≤', geq: '≥', neq: '≠', approx: '≈', sim: '~', equiv: '≡', propto: '∝',
  ll: '≪', gg: '≫',
  // 集合 / 逻辑
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  cup: '∪', cap: '∩', setminus: '\\', emptyset: '∅', forall: '∀', exists: '∃', nexists: '∄',
  // 分隔 / 关系
  mid: '|', parallel: '∥', perp: '⊥', nmid: '∤', shortmid: '∣', vmid: '∣',
  // 箭头
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', hookleftarrow: '↩', hookrightarrow: '↪',
  // 算术
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', ast: '∗', star: '★', circ: '∘',
  bullet: '•', wr: '≀', amalg: '⨿',
  // 空白命令
  quad: ' ', qquad: '  ',
  // 希腊字母（小写）
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', upsilon: 'υ', phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  // 大写希腊字母
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η',
  Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ',
  Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
  // 杂项
  infty: '∞', nabla: '∇', partial: '∂', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ',
  prime: '′',
  // 运算符
  sum: '∑', prod: '∏', int: '∫', oint: '∮', iint: '∬', iiint: '∭',
  ointctrclockwise: '∮', coprod: '⊔', bigwedge: '⊼', bigvee: '⊻', bigcap: '⋂', bigcup: '⋃',
  bigoplus: '⊕', bigotimes: '⊗', bigodot: '⊙', biguplus: '⊎',
  // 三角函数：用文字（符号认不出）
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  log: 'log', ln: 'ln', exp: 'exp',
  // 文字函数
  lim: 'lim', inf: 'inf', sup: 'sup', max: 'max', min: 'min', gcd: 'gcd', mod: 'mod', arg: 'arg',
  // 其它
  therefore: '∴', because: '∵', angle: '∠', triangle: '△',
  simeq: '≃', cong: '≅', lnot: '¬', neg: '¬', lor: '∨', land: '∧',
  // 引号
  lq: "'", rq: "'", ldquo: '"', rdquo: '"',
};

/** 黑板体单字映射（\mathbb{R} → ℝ）。\mathbb{...} 在命令名替换阶段识别。 */
const BLACKBOARD_MAP: Record<string, string> = {
  R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ',
  H: 'ℍ', K: '𝕂', S: '𝕊',
};

/**
 * 单字符 上下标 Unicode 表（用于 x^2 / x_1 这种单字上下标）。
 * 多字符下标走 `_(...)` fallback（避免长下标字符串）。
 */
const SUP_DIGIT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const SUB_DIGIT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

const SUP_LETTER: Record<string, string> = {
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ',
  l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
  A: 'ᴬ', B: 'ᴮ', D: 'ᴰ', E: 'ᴱ', G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ',
  N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ', W: 'ᵂ',
};
const SUB_LETTER: Record<string, string> = {
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
  s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

/** 组合重音（写在字符后面）。单字符时用它比 `‾x‾` 更像公式。 */
const COMBINING: Record<string, string> = {
  overline: '\u0304', bar: '\u0304', hat: '\u0302', widehat: '\u0302',
  tilde: '\u0303', widetilde: '\u0303', dot: '\u0307', ddot: '\u0308',
};

function supGroup(body: string): string {
  if (body.length === 1) return SUP_DIGIT[body] ?? SUP_LETTER[body] ?? body;
  return '^(' + body + ')';
}

function subGroup(body: string): string {
  if (body.length === 1) return SUB_DIGIT[body] ?? SUB_LETTER[body] ?? body;
  return '_(' + body + ')';
}

/**
 * 花括号参数，**允许一层嵌套**。
 *
 * 必须支持嵌套：`\frac{z_1 \overline{z_2}}{z_2 \overline{z_2}}` 这种写法里，
 * 参数内部又带了 `\overline{z_2}` 自己的花括号。用 `[^{}]*` 会匹配不上，
 * 结果整条 `\frac` 原样漏到导出文件里（实测就是这么漏的）。
 */
const ARG = String.raw`\{((?:[^{}]|\{[^{}]*\})*)\}`;
const re = (pattern: string) => new RegExp(pattern, 'g');

/**
 * 带参命令的降级（`\frac{a}{b}` 这类）。
 *
 * **必须先于花括号转圆括号**，否则 `\frac{a}{b}` 会先变成 `frac (a)(b)`，
 * 除法语义丢失。
 */
function expandParamCommandsOnce(text: string): string {
  return text
    .replace(re(String.raw`\\(?:d|t)?frac\s*` + ARG + String.raw`\s*` + ARG), '($1)/($2)')
    .replace(re(String.raw`\\sqrt\s*\[([^{}]+)\]\s*` + ARG), 'root($1)($2)') // \sqrt[n]{x}
    .replace(re(String.raw`\\sqrt\s*` + ARG), 'sqrt($1)')
    .replace(re(String.raw`\\(?:overline|bar)\s*` + ARG), (_w, body: string) =>
      body.length === 1 ? body + COMBINING.overline : '‾' + body + '‾'
    )
    .replace(re(String.raw`\\underline\s*` + ARG), '_$1_')
    .replace(re(String.raw`\\(?:hat|widehat)\s*` + ARG), (_w, body: string) =>
      body.length === 1 ? body + COMBINING.hat : body + '^'
    )
    .replace(re(String.raw`\\(?:tilde|widetilde)\s*` + ARG), (_w, body: string) =>
      body.length === 1 ? body + COMBINING.tilde : '~' + body
    )
    .replace(re(String.raw`\\dot\s*` + ARG), (_w, body: string) =>
      body.length === 1 ? body + COMBINING.dot : '·' + body
    )
    .replace(re(String.raw`\\ddot\s*` + ARG), (_w, body: string) =>
      body.length === 1 ? body + COMBINING.ddot : '··' + body
    )
    .replace(re(String.raw`\\vec\s*` + ARG), '→$1')
    .replace(re(String.raw`\\overrightarrow\s*` + ARG), '→$1')
    .replace(re(String.raw`\\overleftarrow\s*` + ARG), '←$1')
    .replace(re(String.raw`\\boxed\s*` + ARG), '[$1]')
    // 字体类：只保留内容
    .replace(re(String.raw`\\mathbb\s*` + ARG), (_w, body: string) => {
      if (body.length === 1) return BLACKBOARD_MAP[body] ?? body;
      return body;
    })
    .replace(
      re(String.raw`\\(?:mathbf|mathrm|mathit|mathcal|mathfrak|mathsf|mathtt|text|textrm|textit|operatorname|textnormal)\s*` + ARG),
      '$1'
    )
    // \left( \right) 这类尺寸命令：直接删掉
    .replace(/\\(?:left|right|bigl?|bigr?|Bigl?|Bigr?|biggl?|biggr?|displaystyle|textstyle)\b/g, '');
}

/**
 * 反复展开，直到不动 —— `\frac{\frac{a}{b}}{c}` 这种嵌套：
 * 一次 replace 把内层当成**替换结果的一部分**写出去，内层就不会再被扫到了。
 * 迭代 3 轮覆盖实际会出现的嵌套深度（再多的情况内容本身也不可读了）。
 */
function expandParamCommands(text: string): string {
  let cur = text;
  for (let i = 0; i < 3; i++) {
    const next = expandParamCommandsOnce(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** 单字符上标 / 下标（不在花括号里的形式：`x^2`、`a_i`）。 */
function expandInlineScripts(text: string): string {
  return text
    .replace(/\^\s*\{([^{}]*)\}/g, (_w, body: string) => supGroup(body))
    .replace(/_\s*\{([^{}]*)\}/g, (_w, body: string) => subGroup(body))
    // `[^a-z]` 这种正则/集合否定写法里的 `^` 不是上标 —— 前面是 `[` 就不动
    .replace(/(?<!\[)\^([A-Za-z0-9])/g, (_w, c: string) => SUP_DIGIT[c] ?? SUP_LETTER[c] ?? c);
}

/** 反斜杠命令名 → 符号（白名单）+ 单字符空白命令。 */
function expandCommandNames(text: string, keepUnknown: boolean): string {
  return text
    .replace(/\\([a-zA-Z]+)/g, (whole: string, name: string) => {
      const mapped = COMMAND_MAP[name];
      if (mapped !== undefined) return mapped;
      // 围符内 = 确定是公式：去掉反斜杠至少不留下源码；正文里保留原文，
      // 免得把 `C:\Users` 这种普通反斜杠吃掉（unknown 命令在正文里极罕见）
      return keepUnknown ? whole : name;
    })
    // 转义花括号（`\{` `\}` = 字面花括号，集合记法常用）
    .replace(/\\([{}])/g, '$1')
    .replace(/\\([,;:!\s])/g, (_w, c: string) => (c === '!' ? '' : ' '));
}

/**
 * 全量降级：调用方**确认整段就是 LaTeX**（围符内 / 围栏内 / notation 字段）。
 */
function readableLatex(latex: string): string {
  let out = expandParamCommands(latex);
  // 转义花括号（`\{` `\}` = 字面花括号，集合记法常用）：先换哨兵，
  // 免得下面"花括号转圆括号"把集合记法的花括号也吃掉。
  out = out.replace(/\\\{/g, '\uE000').replace(/\\\}/g, '\uE001');
  out = expandInlineScripts(out);
  // 裸 `a_i`：确定是公式，下标一路降级
  out = out.replace(/_([A-Za-z0-9])/g, (_w, c: string) => SUB_DIGIT[c] ?? SUB_LETTER[c] ?? c);
  out = expandCommandNames(out, false);
  out = out.replace(/[{}]/g, (m) => (m === '{' ? '(' : ')'));
  out = out.replace(/\uE000/g, '{').replace(/\uE001/g, '}');
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * 裸 LaTeX 的**命令级**降级（嵌在散文里、没有围符）。
 *
 * 保守到什么程度：不动花括号、不动裸 `_x`、不认识的反斜杠命令原样保留。
 * 只保证 `i \times i=-1`、`a,b \in \mathbb{R}`、`i^{4n}=1`、`\overline{z}` 这类
 * 变成可读文本。
 */
function readableBareCommands(text: string): string {
  // 先做一次廉价的门控：没有反斜杠命令、没有上下标花括号、没有 `x^2`，
  // 直接原样返回（绝大多数散文走这条路）。
  if (!/\\([a-zA-Z]|[,;:!\s])|\^\s*\{|_\s*\{|\^[A-Za-z0-9]/.test(text)) return text;
  let out = expandParamCommands(text);
  out = expandInlineScripts(out);
  out = expandCommandNames(out, true);
  return out;
}

/**
 * ```latex ... ``` 围栏。
 *
 * 语言段单独捕获：**不能把任意语言的围栏都当公式**（文档模块里会出现
 * ```python / ```json 的代码块，按公式降级会把代码吃坏）。
 *  - 数学语言（latex / tex / math / katex）→ 全量降级；
 *  - 无语言 → 只脱围栏，内容继续走后续的围符 / 裸命令处理（` ```\n$E=mc^2$\n``` `）；
 *  - 其它语言 → 原样保留。
 */
const FENCE_RE = /```[ \t]*([A-Za-z]*)[ \t]*([\s\S]*?)```/g;

function degradeFence(_whole: string, lang: string, body: string): string {
  const l = (lang || '').toLowerCase();
  if (l === 'latex' || l === 'tex' || l === 'math' || l === 'katex') return readableLatex(body.trim());
  // 无语言 / 其它语言（python、json…）：只脱掉围栏标记，内容原样留下。
  // **不能按公式降级** —— 那会把代码块里的反斜杠、花括号当 LaTeX 处理。
  return body.trim();
}

/**
 * 把文本里的行内 / 行间公式替换成可读纯文本。
 *
 * **必须处理**：AI 生成的每个字段都可能夹带公式。
 * 不处理的话 PDF 里会直接露出 `$i^2=-1$` 这种源码 —— 用户看到的是
 * "工具没把公式渲染出来"，而不是"这是纯文本 PDF 的固有限制"。
 */
export function readableLatexInText(text: string): string {
  if (!text) return '';
  let out = text
    // 围栏块：先剥（数学语言的按"确定是公式"全量降级）
    .replace(FENCE_RE, degradeFence)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_w, inner: string) => readableLatex(inner.trim()))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_w, inner: string) => readableLatex(inner.trim()))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_w, inner: string) => readableLatex(inner.trim()))
    .replace(/\$([^$\n]+?)\$/g, (_w, inner: string) => readableLatex(inner.trim()));
  out = readableBareCommands(out);
  return out;
}

/**
 * 显式输入的 LaTeX 表达式（`Concept.notation` 就是这种：提示词要求"纯 LaTeX，不加围符"）。
 * 与 `readableLatexInText` 的区别：这里**假定整段都是公式**，全量降级。
 */
export function readableLatexExpression(latex: string): string {
  if (!latex) return '';
  const unwrapped = String(latex).replace(FENCE_RE, (_w, _lang: string, body: string) => body);
  return readableLatex(unwrapped.trim());
}

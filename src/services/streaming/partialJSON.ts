/**
 * 增量 JSON 解析器（流式共享缓冲区）
 * ------------------------------------------------------------------
 * 设计意图：
 *   一次 AI 调用返回一个大 JSON。传统做法是等全文到齐再 JSON.parse，
 *   用户只能干等。这里把"AI 输出"和"UI 渲染"解耦成生产者/消费者：
 *
 *        AI 输出流 ──push(chunk)──▶ [ StreamingJSONParser 缓冲区 ]
 *                                            │
 *                                  read() ───┘（随时取当前可渲染快照）
 *                                            ▼
 *                                       React setState
 *
 *   两边共享同一份数据，写入与读取互不阻塞：
 *   - 生产者（AI）：只管往缓冲区追加字符，不关心解析
 *   - 消费者（渲染）：只管按自己的节奏（rAF/节流）取快照，不关心网络
 *
 * 核心能力：对**任意截断位置**的 JSON 前缀，都能补出一份结构合法、
 * 可安全渲染的部分对象。已经写完的字段原样保留，正在写的字符串按
 * 当前已到达的字符呈现（从而实现"打字机"效果）。
 */

/** 一次快照：渲染侧唯一需要关心的东西 */
export interface PartialJSONSnapshot<T> {
  /** 当前可渲染的部分对象；连一个字段都还没成形时为 null */
  data: T | null;
  /** 整个 JSON 是否已完整闭合（最后一个 } 已到达） */
  complete: boolean;
  /** 已完整闭合的顶层字段名，用于 UI 判断某区块是否出完（收骨架屏） */
  completedKeys: string[];
  /** 已接收的原始字符数（不含 markdown 围栏） */
  received: number;
}

interface Frame {
  type: '{' | '[';
  /** 当前是否在等一个 key（对象内、值已结束或刚开始） */
  keyExpected: boolean;
  /** 已读到 `:` 但值尚未结束的 key 名 */
  pendingKey: string | null;
}

interface ScanState {
  /** 扫描结束时是否停在字符串内部（决定要不要补闭合引号） */
  inString: boolean;
  /** 未闭合的容器栈（决定补哪些闭合括号） */
  stack: ('{' | '[')[];
  /** 最后一个"结构安全"的切割下标：buf.slice(0, n) 恰好结束于某个完整值之后 */
  lastSafeIndex: number;
  /** 顶层值闭合的下标（complete 为 true 时有效；其后可能还有围栏等尾随内容） */
  endIndex: number;
  /** 已完整闭合的顶层字段名 */
  completedKeys: string[];
  /** 整个 JSON 是否已闭合 */
  complete: boolean;
}

/**
 * 单趟扫描，产出增量解析所需的全部结构信息。
 * 全程手工处理转义，不依赖正则，避免被字符串里的花括号/引号误导。
 *
 * 导出的原因：它是全项目「JSON 是否完整闭合」的**权威判定**（同时正确追踪
 * `{}` 与 `[]` 嵌套、字符串转义、markdown 围栏剥离）。业务层（如超限续写的
 * `hasCompleteJSONObject`）应复用它，而不是另写一套括号配对逻辑——否则两套判定
 * 会漂移（曾出现过"只判 `{}` 漏判 `[]`，数组未闭合被误判完整"的边界漏洞）。
 */
export function scan(buf: string): ScanState {
  const stack: ('{' | '[')[] = [];
  const frames: Frame[] = [];
  const completedKeys: string[] = [];

  let inString = false;
  let escape = false;
  let lastSafeIndex = 0;
  let endIndex = 0;
  let complete = false;

  // 字符串相关的临时状态
  let isKeyString = false;
  let keyStart = -1;
  let currentKeyName: string | null = null;

  // 值相关
  let valueStarted = false;
  let valueEnded = false;

  const top = () => frames[frames.length - 1];

  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];

    // ---------- 字符串内部：只有引号和转义有意义 ----------
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c !== '"') continue;

      inString = false;
      if (isKeyString) {
        currentKeyName = buf.slice(keyStart + 1, i);
        isKeyString = false;
        if (top()) top().keyExpected = false;
      } else {
        // 一个字符串值写完了
        valueEnded = true;
        lastSafeIndex = i + 1;
        const f = top();
        if (f && stack.length === 1 && f.pendingKey !== null) {
          completedKeys.push(f.pendingKey);
          f.pendingKey = null;
        }
      }
      continue;
    }

    switch (c) {
      case '"': {
        inString = true;
        escape = false;
        const f = top();
        if (f && f.type === '{' && f.keyExpected) {
          isKeyString = true;
          keyStart = i;
        } else {
          valueStarted = true;
        }
        break;
      }
      case '{':
      case '[': {
        stack.push(c);
        frames.push({ type: c, keyExpected: c === '{', pendingKey: null });
        valueStarted = false;
        valueEnded = false;
        // 容器刚开始，本身就是一个安全切割点
        lastSafeIndex = i + 1;
        break;
      }
      case '}':
      case ']': {
        // `123}` 这类字面量紧贴闭合括号的情况，在此补齐"值刚结束"
        if (valueStarted) valueEnded = true;
        const f = top();
        if (f && stack.length === 1 && f.pendingKey !== null && (valueEnded || valueStarted)) {
          completedKeys.push(f.pendingKey);
          f.pendingKey = null;
        }
        lastSafeIndex = i + 1;
        stack.pop();
        frames.pop();
        if (stack.length === 0) {
          complete = true;
          endIndex = i + 1;
        }
        valueStarted = false;
        valueEnded = false;
        // 顶层字段的值本身是「容器」（数组 / 对象）时，闭合的这一刻就要登记完成。
        // 上面的 push 只覆盖「字符串 / 字面量」型值（那些值的收尾直接发生在所属帧内）；
        // 容器型值的收尾发生在它自己的帧弹栈之后，父帧此时才写完该字段的值。
        // 若不补这一步，流式过程中 completedKeys 会长期缺失 mindMap / concepts /
        // knowledgeContext 等字段，步骤指示就会一直卡在"正在生成知识导图"不动。
        {
          const parent = top();
          if (stack.length === 1 && parent && parent.pendingKey !== null) {
            completedKeys.push(parent.pendingKey);
            parent.pendingKey = null;
          }
        }
        break;
      }
      case ',': {
        if (valueStarted) valueEnded = true;
        const f = top();
        if (f && stack.length === 1 && f.pendingKey !== null && valueEnded) {
          completedKeys.push(f.pendingKey);
          f.pendingKey = null;
        }
        lastSafeIndex = i + 1;
        if (f) {
          f.keyExpected = f.type === '{';
          f.pendingKey = null;
        }
        currentKeyName = null;
        valueStarted = false;
        valueEnded = false;
        break;
      }
      case ':': {
        const f = top();
        if (f) f.pendingKey = currentKeyName;
        currentKeyName = null;
        valueStarted = false;
        valueEnded = false;
        break;
      }
      default: {
        // 空白跳过；其余（数字/true/false/null）视为字面量的一部分
        if (c === ' ' || c === '\n' || c === '\r' || c === '\t') break;
        valueStarted = true;
        break;
      }
    }
  }

  return { inString, stack, lastSafeIndex, endIndex, completedKeys, complete };
}

/**
 * 去掉 markdown 围栏与前言，返回第一个 `{` / `[` 起的内容。
 * 还没出现起始符时返回空串 —— 表示"再等等"。
 */
function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*/i);
  const body = fenceMatch ? trimmed.slice(fenceMatch[0].length) : trimmed;
  const start = body.search(/[{[]/);
  return start >= 0 ? body.slice(start) : '';
}

/**
 * 判断一段文本里是否已出现一个**完整闭合**的顶层 JSON 对象（或数组）。
 *
 * 这是「JSON 完整性」的唯一权威判定：复用 scan 的括号追踪（`{}` + `[]` 都跟踪、
 * 正确处理字符串转义与 markdown 围栏），供业务层（如超限续写）复用。
 * 返回 false 表示"还没写完"或"根本没有 JSON"。
 */
export function isCompleteJSON(raw: string): boolean {
  const stripped = stripFence(raw);
  if (!stripped) return false;
  return scan(stripped).complete;
}

/**
 * 分析一段文本的 JSON 结构状态，返回权威判定结果。
 *
 * 与 isCompleteJSON 相比，额外吐出 completedKeys（已完整闭合的顶层字段名），
 * 供"字段齐全"类判定复用（例如超限续写不仅要括号闭合、还要核心字段都出齐）。
 * 返回 null 表示文本里还没有 JSON 起始符（还在前言/围栏阶段）。
 */
export function analyzeJSON(raw: string): { complete: boolean; completedKeys: string[] } | null {
  const stripped = stripFence(raw);
  if (!stripped) return null;
  const st = scan(stripped);
  return { complete: st.complete, completedKeys: st.complete ? Object.keys(parsePrefix(stripped, st.endIndex) ?? {}) : st.completedKeys };
}

/**
 * 把 buf 的前 cutIndex 个字符补成一份合法 JSON 并解析。
 * 补法：去掉尾部悬挂的 `,` / `:` / 半个 key，闭合未结束的字符串，再按栈补括号。
 */
function parsePrefix(buf: string, cutIndex: number): unknown | null {
  let s = buf.slice(0, cutIndex);
  // 尾部悬挂的逗号、冒号、以及刚开头还没写值的 key
  s = s.replace(/[\s,]+$/, '');
  s = s.replace(/"(?:[^"\\]|\\.)*"?\s*:\s*$/, '');
  s = s.replace(/[\s,]+$/, '');
  if (!s) return null;

  const st = scan(s);
  let candidate = st.inString ? s + '"' : s;
  for (let i = st.stack.length - 1; i >= 0; i--) {
    candidate += st.stack[i] === '{' ? '}' : ']';
  }
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export class StreamingJSONParser<T = any> {
  private buf = '';
  private started = false;
  private lastSnapshot: PartialJSONSnapshot<T> = {
    data: null,
    complete: false,
    completedKeys: [],
    received: 0,
  };

  /** 生产者侧：AI 每吐出一小段就调一次 */
  push(chunk: string): PartialJSONSnapshot<T> {
    if (!chunk) return this.lastSnapshot;

    if (!this.started) {
      // 还没见到 JSON 起始符，先攒着（可能是围栏或前言文字）
      this.buf += chunk;
      const stripped = stripFence(this.buf);
      if (!stripped) return this.lastSnapshot; // 继续等
      this.started = true;
      this.buf = stripped;
    } else {
      this.buf += chunk;
    }

    return this.read();
  }

  /** 消费者侧：随时取当前快照（幂等，可高频调用，内部只在结构变化时重解析） */
  read(): PartialJSONSnapshot<T> {
    if (!this.started || !this.buf) return this.lastSnapshot;

    const st = scan(this.buf);

    // 目标切割点：
    // - 已闭合 → 取闭合处，避开尾部围栏等无关内容
    // - 未闭合 → 取全长，让"正在写的字符串"也参与解析，从而形成打字机效果
    const target = st.complete ? st.endIndex : this.buf.length;
    let data = parsePrefix(this.buf, target) as T | null;

    // 全长解析失败（例如字符串尾部正好停在转义符上）→ 退到上一个安全切割点
    if (data === null) {
      data = parsePrefix(this.buf, st.lastSafeIndex) as T | null;
    }

    this.lastSnapshot = {
      data,
      complete: st.complete,
      completedKeys: st.complete ? Object.keys(data ?? {}) : st.completedKeys,
      received: this.buf.length,
    };
    return this.lastSnapshot;
  }

  /** 流结束时调用：确保拿到最终结果 */
  finish(): PartialJSONSnapshot<T> {
    if (!this.started) {
      const stripped = stripFence(this.buf);
      this.started = true;
      this.buf = stripped;
    }
    return this.read();
  }

  /** 已接收的原始文本（调试/落库用） */
  get raw(): string {
    return this.buf;
  }
}

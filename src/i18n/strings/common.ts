/**
 * i18n · 公共 / 布局 / AI 面板 文案
 * ------------------------------------------------------------------
 * 每个 area 文件约定：
 *   - `<area>En` 是**类型来源**（English 基准）
 *   - `<area>Zh` 必须实现同结构
 *   - 占位符统一用 `{name}`，由 `fmt()` 填充
 *
 * 之所以按 area 拆文件而不是塞一个巨型对象：单文件 > 800 行后改文案极易误删键，
 * 且多个功能同时改文案会冲突。
 */

export const commonEn = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    copy: 'Copy',
    close: 'Close',
    unknown: 'Unknown',
    done: 'Done',
    favorite: 'Favorite',
    favorited: 'Favorited',
    unfavorite: 'Remove favorite',
    justNow: 'Just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    aiKeyRequired: 'Please configure an AI model API key first',
    optional: 'optional',

    /**
     * 复制 / 导出反馈。
     *
     * 归在 `common` 下而不是各模块：这两个动作横跨全部模块
     * （查词 / 查句 / 搜索 / 问答 / 文档 / 收藏），文案必须**只有一处**。
     * 尤其 `copyFailed` 不能省 —— 两条复制路径（Async Clipboard / execCommand）
     * 在权限被拒或浏览器策略下都会静默失败，没有提示用户就只会觉得"这应用坏了"。
     */
    exportActions: {
      copied: 'Copied to clipboard',
      copyFailed: 'Copy failed — please select the text and copy manually',
      exportDone: 'File downloaded',
      exportFailed: 'Export failed, please try again',
      exportDocx: 'Export as Word',
      exportPdf: 'Export as PDF',
      /** PDF 走内置生成器：中文字体由阅读器提供，文字可复制（不再走浏览器打印） */
      exportPdfHint: 'Chinese text stays selectable and searchable',
      downloadImage: 'Download image',
      imageOpened: 'Opened in a new tab (cross-origin images can only be opened this way)',
      /** 试题配图无法随文字导出时留下的说明，避免用户直接答一道无图的题 */
      figureOmitted: '(This question has a figure that cannot be exported with the text)',
    },
  },

  app: {
    brand: 'Knowledge Agile Assistant',
    footer: 'Knowledge Agile Assistant — an AI-powered knowledge workspace',
    copyright: '© {year} {author} · All rights reserved',
    clearAllHistoryTitle: 'Clear all history',
    clearAllHistoryMessage: 'Are you sure you want to clear all history? This cannot be undone.',
    confirmClearAll: 'Clear all',
    menuTheme: 'Theme',
    menuLanguage: 'Language',
    menuSettings: 'Settings',
    themeLight: 'Light',
    themeDark: 'Dark',
    languageHint: 'Defaults to your system language. AI-generated content follows this language.',
    clearHistory: 'Clear all history',
  },

  tabs: {
    search: 'Knowledge Search',
    translate: 'Dictionary',
    doc: 'Documents',
    favorites: 'Favorites',
  },

  aiPanel: {
    tabModel: 'Model',
    tabKeys: 'API Keys',
    tabAddVendor: 'Add Vendor',
    tabSpeech: 'Reading',
    selectVendor: 'Select vendor',
    presetVendors: 'Preset vendors',
    customVendors: 'Custom vendors',
    unknownVendor: 'Unknown vendor',
    statusValid: 'Configured',
    statusInvalid: 'Config invalid',
    statusConfiguring: 'Configuring...',
    statusUnconfigured: 'No API key',
    officialDocs: 'Official docs',
  },

  wanx: {
    title: 'Image generation service',
    desc: 'Optional: Tongyi Wanxiang (wanx) for image generation as fallback for dictionary word illustrations.',
    placeholder: 'DashScope API Key (sk-...)',
    configured: 'Configured',
    showKey: 'Show',
    hideKey: 'Hide',
    clear: 'Clear',
    note: 'Leave empty to disable. Independent endpoint & billing, does not affect the main AI flow.',
  },
};

export type CommonStrings = typeof commonEn;

export const commonZh: CommonStrings = {
  common: {
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    copy: '复制',
    close: '关闭',
    unknown: '未知',
    done: '完成',
    favorite: '收藏',
    favorited: '已收藏',
    unfavorite: '取消收藏',
    justNow: '刚刚',
    minutesAgo: '{n}分钟前',
    hoursAgo: '{n}小时前',
    daysAgo: '{n}天前',
    aiKeyRequired: '请先配置AI模型密钥',
    optional: '可选',

    exportActions: {
      copied: '已复制到剪贴板',
      copyFailed: '复制失败，请手动选中文本复制',
      exportDone: '文件已下载',
      exportFailed: '导出失败，请重试',
      exportDocx: '导出为 Word',
      exportPdf: '导出为 PDF',
      exportPdfHint: '中文可选中、可搜索（不再需要「另存为 PDF」）',
      downloadImage: '下载图片',
      imageOpened: '已在新标签页打开（跨域图片只能这样保存）',
      figureOmitted: '（本题原有配图，无法随文字导出）',
    },
  },

  app: {
    brand: '知识灵动助手',
    footer: '知识灵动助手 - AI驱动的知识办公应用',
    copyright: '© {year} {author} · 保留所有权利',
    clearAllHistoryTitle: '确认清空所有历史记录',
    clearAllHistoryMessage: '确定要清空所有历史记录吗？此操作不可撤销。',
    confirmClearAll: '确认清空',
    menuTheme: '主题',
    menuLanguage: '语言 / Language',
    menuSettings: '设置',
    themeLight: '浅色',
    themeDark: '深色',
    languageHint: '默认跟随系统语言；AI 生成的内容将以该语言输出。',
    clearHistory: '清空所有历史记录',
  },

  tabs: {
    search: '知识搜索',
    translate: '词典翻译',
    doc: '文档生成',
    favorites: '收藏空间',
  },

  aiPanel: {
    tabModel: '模型选择',
    tabKeys: '密钥管理',
    tabAddVendor: '添加厂商',
    tabSpeech: '语音朗读',
    selectVendor: '选择厂商',
    presetVendors: '预设厂商',
    customVendors: '自定义厂商',
    unknownVendor: '未知厂商',
    statusValid: '已配置',
    statusInvalid: '配置失效',
    statusConfiguring: '配置中...',
    statusUnconfigured: '未配置密钥',
    officialDocs: '官方文档',
  },

  wanx: {
    title: '生图服务',
    desc: '可选：通义万相（wanx）文本生图，作为查词/知识概念配图兜底。',
    placeholder: 'DashScope API Key（sk-...）',
    configured: '已配置',
    showKey: '显示',
    hideKey: '隐藏',
    clear: '清除',
    note: '留空即关闭。独立端点、独立计费，不影响主 AI 流程。',
  },
};

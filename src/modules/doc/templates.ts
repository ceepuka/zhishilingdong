import { DocType, EmailTone } from '../../types';
import { fmt } from '../../i18n/strings';
import { getDocBodies } from '../../i18n/strings/docTemplates';

/**
 * 文档模板
 * ------------------------------------------------------------------
 * 只放**与语言无关**的结构（id / icon）；展示名走 i18n（doc.types / doc.tone*）。
 * 正文骨架是 AI 不可用时的兜底，按语言取用（见 i18n/strings/docTemplates.ts）。
 */

export const DOC_TYPE_META: { id: DocType; icon: string }[] = [
  { id: 'general', icon: '📝' },
  { id: 'email', icon: '✉️' },
  { id: 'report', icon: '📊' },
  { id: 'meeting', icon: '📝' },
  { id: 'ppt', icon: '📑' },
  { id: 'notes', icon: '📚' },
  { id: 'contract', icon: '📋' },
  { id: 'resume', icon: '👤' },
  { id: 'press', icon: '📰' },
  { id: 'proposal', icon: '💡' },
  { id: 'weekly', icon: '📅' },
];

export const EMAIL_TONE_IDS: EmailTone[] = ['formal', 'friendly', 'concise'];

export const generateGeneral = (topic: string, language: string): string =>
  fmt(getDocBodies(language).general, { topic });

export const generateEmail = (
  topic: string,
  tone: EmailTone,
  from: string,
  to: string,
  language: string,
): string => {
  const email = getDocBodies(language).email;
  const greeting = fmt(email.greeting[tone], { to });
  const body = fmt(email.body[tone], { topic });
  const closing = fmt(email.closing[tone], { from });
  return `${greeting}\n\n${body}\n\n${closing}`;
};

export const generateReport = (topic: string, language: string): string =>
  fmt(getDocBodies(language).report, { topic });

export const generateMeeting = (topic: string, language: string): string =>
  fmt(getDocBodies(language).meeting, { topic });

export const generatePPT = (topic: string, language: string): string =>
  fmt(getDocBodies(language).ppt, { topic });

export const generateNotes = (topic: string, language: string): string =>
  fmt(getDocBodies(language).notes, { topic });

export const generateContract = (topic: string, language: string): string =>
  fmt(getDocBodies(language).contract, { topic });

export const generateResume = (topic: string, language: string): string =>
  fmt(getDocBodies(language).resume, { topic });

export const generatePress = (topic: string, language: string): string =>
  fmt(getDocBodies(language).press, { topic });

export const generateProposal = (topic: string, language: string): string =>
  fmt(getDocBodies(language).proposal, { topic });

export const generateWeekly = (topic: string, language: string): string =>
  fmt(getDocBodies(language).weekly, { topic });

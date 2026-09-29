import { ChatMessage } from '../../../types';
import { getCurrentStrings, fmt } from '../../../i18n/strings';

/**
 * 无 Key / AI 不可用时的兜底回复。
 * 文案全部走 i18n —— 中文界面回中文、其他语言回英文。
 * 认词时同时匹配中英文关键词，避免切换界面语言后语气检测失效。
 */

const getRandomReply = (list: string[]): string => {
  return list[Math.floor(Math.random() * list.length)];
};

const GREETING_WORDS = ['hello', 'hi', 'hey', '你好', '您好', '嗨', '哈喽'];
const THANKS_WORDS = ['thank', 'thanks', '谢谢', '多谢', '感谢'];
const FAREWELL_WORDS = ['bye', 'goodbye', '再见', '拜拜'];

const matches = (text: string, words: string[]): boolean => words.some(w => text.includes(w));

export const generateReply = (question: string): string => {
  const replies = getCurrentStrings().search.mockReplies;
  const lowerQuestion = question.toLowerCase().trim();

  if (matches(lowerQuestion, GREETING_WORDS)) return getRandomReply(replies.greeting);
  if (matches(lowerQuestion, THANKS_WORDS)) return getRandomReply(replies.thanks);
  if (matches(lowerQuestion, FAREWELL_WORDS)) return getRandomReply(replies.goodbye);

  return fmt(replies.followUpTemplate, {
    reply: getRandomReply(replies.fallback),
    question,
  });
};

export const createUserMessage = (content: string): ChatMessage => ({
  id: Date.now().toString(),
  role: 'user',
  content,
  timestamp: Date.now(),
});

export const createAssistantMessage = (content: string): ChatMessage => ({
  id: (Date.now() + 1).toString(),
  role: 'assistant',
  content,
  timestamp: Date.now(),
});
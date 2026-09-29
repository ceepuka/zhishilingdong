import { useState, useCallback, useRef } from 'react';
import { ChatMessage, FollowupMessage } from '../../../types';
import { aiService } from '../../../services/aiServiceProvider';
import { getCurrentStrings } from '../../../i18n/strings';
import { createUserMessage, createAssistantMessage } from '../services/QAService';
import { useHistory } from '../../../hooks/HistoryContext';

export type SearchMode = 'search' | 'qa';

/** 流式渲染节流间隔（ms） */
const QA_RENDER_THROTTLE_MS = 60;

export interface SearchModeState {
  mode: SearchMode;
  qaMessages: ChatMessage[];
  sidebarOpen: boolean;
  expanded: boolean;
  viewMode: 'graph' | 'mindmap';
}

export const useSearchMode = () => {
  const [mode, setMode] = useState<SearchMode>('search');
  const [qaMessages, setQAMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'mindmap'>('graph');
  const [isLoading, setIsLoading] = useState(false);

  const processingRef = useRef<Set<string>>(new Set());
  const qaMessagesRef = useRef<ChatMessage[]>([]);

  const { addHistory, updateQASession, getQASession } = useHistory();

  const switchMode = useCallback((newMode: SearchMode) => {
    setMode(newMode);
    if (newMode === 'search') {
      setQAMessages([]);
      qaMessagesRef.current = [];
    }
  }, []);

  const sendMessage = useCallback(async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    if (processingRef.current.has(trimmedQuestion)) return;
    processingRef.current.add(trimmedQuestion);

    const session = getQASession(trimmedQuestion);
    if (session) {
      setQAMessages(session.messages);
      qaMessagesRef.current = session.messages;
      processingRef.current.delete(trimmedQuestion);
      return;
    }

    const userMessage = createUserMessage(trimmedQuestion);
    const currentMessages = qaMessagesRef.current;
    const isFirstMessage = currentMessages.length === 0;
    const newMessages = isFirstMessage ? [userMessage] : [...currentMessages, userMessage];

    setQAMessages(newMessages);
    qaMessagesRef.current = newMessages;

    if (isFirstMessage) {
      // addHistory 已把 lastViewedAt 初始化为创建时刻，无需再 touch
      addHistory(trimmedQuestion, 'qa', {
        id: `qa-${Date.now()}`,
        messages: newMessages,
        timestamp: Date.now(),
      });
    } else {
      const firstQuestion = currentMessages[0].content;
      updateQASession(firstQuestion, newMessages);
    }

    setIsLoading(true);

    // 先插一条空的助手消息占位，随后流式增量原地填充它（同一条消息增长，不刷屏）
    const placeholder: ChatMessage = {
      ...createAssistantMessage(''),
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    const streamingMessages = [...newMessages, placeholder];
    setQAMessages(streamingMessages);
    qaMessagesRef.current = streamingMessages;

    const patchAssistant = (content: string) => {
      const updated = qaMessagesRef.current.map(m =>
        m.id === placeholder.id ? { ...m, content } : m
      );
      qaMessagesRef.current = updated;
      setQAMessages(updated);
    };

    try {
      const historyMessages: FollowupMessage[] = newMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      let lastRenderAt = 0;
      const response = await aiService.search.followupStream(
        trimmedQuestion,
        trimmedQuestion,
        historyMessages,
        'qa',
        (delta) => {
          const now = Date.now();
          // 节流：避免每个字都触发一次渲染，同时保证结尾一定刷新
          if (delta.complete || now - lastRenderAt >= QA_RENDER_THROTTLE_MS) {
            lastRenderAt = now;
            patchAssistant(delta.reply);
          }
        }
      );

      const finalReply =
        response.success && response.data ? response.data.reply : getCurrentStrings().search.qa.cannotAnswer;
      const updatedMessages = qaMessagesRef.current.map(m =>
        m.id === placeholder.id ? { ...m, content: finalReply } : m
      );
      setQAMessages(updatedMessages);
      qaMessagesRef.current = updatedMessages;

      const firstQuestion = updatedMessages[0].content;
      updateQASession(firstQuestion, updatedMessages);
    } catch (error) {
      console.error('QA error:', error);
      const updatedMessages = qaMessagesRef.current.map(m =>
        m.id === placeholder.id ? { ...m, content: getCurrentStrings().search.qa.networkError } : m
      );
      setQAMessages(updatedMessages);
      qaMessagesRef.current = updatedMessages;

      const firstQuestion = updatedMessages[0].content;
      updateQASession(firstQuestion, updatedMessages);
    } finally {
      setIsLoading(false);
      processingRef.current.delete(trimmedQuestion);
    }
  }, [addHistory, getQASession, updateQASession]);

  const clearQAMessages = useCallback(() => {
    // 离开当前问答会话的"最后浏览时刻"由 HistorySidebar 统一维护，这里无需 touch
    setQAMessages([]);
    qaMessagesRef.current = [];
    processingRef.current.clear();
  }, []);

  const loadQASession = useCallback((query: string) => {
    const session = getQASession(query);
    if (session) {
      setQAMessages(session.messages);
      qaMessagesRef.current = session.messages;
    } else {
      sendMessage(query);
    }
  }, [getQASession, sendMessage]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const setSidebarState = useCallback((open: boolean) => {
    setSidebarOpen(open);
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const setExpandedState = useCallback((expanded: boolean) => {
    setExpanded(expanded);
  }, []);

  const resetState = useCallback(() => {
    setExpanded(false);
    setViewMode('graph');
  }, []);

  return {
    mode,
    qaMessages,
    sidebarOpen,
    expanded,
    viewMode,
    isLoading,
    switchMode,
    sendMessage,
    clearQAMessages,
    loadQASession,
    toggleSidebar,
    setSidebarState,
    toggleExpanded,
    setExpandedState,
    setViewMode,
    resetState,
  };
};

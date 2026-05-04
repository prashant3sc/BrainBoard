import { useState, useCallback, useRef } from 'react';
import { aiApi, type ChatResponse, type WikiContext } from '@/api/ai';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  out_of_scope?: boolean;
  isLoading?: boolean;
}

interface UseAIChatOptions {
  projectId?: string;
  sprintId?: string;
  page?: string;
}

export function useAIChat({ projectId, sprintId, page }: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const sendMessage = useCallback(async (text: string, wikiContext?: WikiContext) => {
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const loadingMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      let res: ChatResponse;

      if (wikiContext) {
        // Wiki page: use legacy endpoint that injects raw wiki text
        res = await aiApi.chat(text, projectId, wikiContext);
      } else {
        // All other pages: use sprint/project-aware endpoint with live DB context
        res = await aiApi.chatQuery({
          query: text,
          project_id: projectId ?? null,
          sprint_id: sprintId ?? null,
          page: page ?? '',
          history: historyRef.current,
        });
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: res.answer, sources: res.sources, out_of_scope: res.out_of_scope, isLoading: false }
            : m,
        ),
      );

      // Keep last 4 exchanges (8 messages) as context for next turn
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: text },
        { role: 'assistant', content: res.answer },
      ].slice(-8);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: 'Something went wrong. Please try again.', isLoading: false }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, sprintId, page]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
  }, []);

  return { messages, isLoading, sendMessage, clearMessages };
}

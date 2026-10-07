import { useCallback, useEffect, useRef, useState } from "react";
import { chatNetwork } from "../services/backend";
import type { ChatResult, QueryScope } from "../types/backend";

export interface QueryEntry {
  id: number; question: string; answer: string; failed: boolean;
  scope: string; createdAt: string;
}
export default function useNetworkQuery() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const reset = useCallback(() => {
    revision.current++; controller.current?.abort(); controller.current = null;
    setPending(false); setError(""); setResult(null);
  }, []);
  useEffect(() => () => { revision.current++; controller.current?.abort(); }, []);
  async function submit(message: string, scenario: string, window?: QueryScope) {
    if (!message.trim() || controller.current) return;
    const token = ++revision.current, abort = new AbortController();
    controller.current = abort; setPending(true); setError(""); setResult(null);
    try {
      const response = await chatNetwork(message.trim(), scenario, window, abort.signal);
      if (revision.current !== token) return;
      setResult(response);
      setHistory(previous => [{ id: token, question: message.trim(), answer: response.reply,
        failed: false, scope: `${response.scope.scenario} · ${response.scope.start} — ${response.scope.end}`,
        createdAt: new Date().toISOString() }, ...previous].slice(0, 6));
    } catch (reason) {
      if (revision.current !== token) return;
      const text = reason instanceof Error ? reason.message : "对话请求失败";
      setError(text);
      setHistory(previous => [{ id: token, question: message.trim(), answer: text,
        failed: true, scope: scenario, createdAt: new Date().toISOString() }, ...previous].slice(0, 6));
    } finally {
      if (revision.current === token) { controller.current = null; setPending(false); }
    }
  }
  return { pending, error, result, history, submit, reset, clearHistory: () => setHistory([]) };
}

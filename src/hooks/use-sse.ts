"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface SSEMessage<T = Record<string, unknown>> {
  event: string;
  data: T;
}

export function useSSE<T = Record<string, unknown>>(url: string | null) {
  const [messages, setMessages] = useState<SSEMessage<T>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    const events = [
      "connected",
      "progress",
      "log",
      "game-complete",
      "game-error",
      "complete",
      "error",
    ];

    for (const eventName of events) {
      eventSource.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as T;
          setMessages((prev) => [...prev, { event: eventName, data }]);
        } catch {
          // Ignore parse failures
        }
      });
    }

    eventSource.onerror = () => {
      setIsConnected(false);
      setError(new Error("Connection lost"));
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [url]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, error, clearMessages };
}

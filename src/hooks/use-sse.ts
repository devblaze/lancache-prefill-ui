"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface SSEMessage<T = Record<string, unknown>> {
  event: string;
  data: T;
}

const SSE_EVENTS = [
  "connected",
  "progress",
  "log",
  "game-complete",
  "game-error",
  "complete",
  "error",
] as const;

const MAX_RECONNECT_DELAY = 10000;

export function useSSE<T = Record<string, unknown>>(url: string | null) {
  const [messages, setMessages] = useState<SSEMessage<T>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!url) return;

    doneRef.current = false;
    retriesRef.current = 0;

    function connect() {
      if (doneRef.current) return;

      const eventSource = new EventSource(url!);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        retriesRef.current = 0;
      };

      for (const eventName of SSE_EVENTS) {
        eventSource.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as T;
            setMessages((prev) => [...prev, { event: eventName, data }]);

            // Job finished — stop reconnecting
            if (eventName === "complete" || eventName === "error") {
              doneRef.current = true;
            }
          } catch {
            // Ignore parse failures
          }
        });
      }

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        // Don't reconnect if the job is done
        if (doneRef.current) return;

        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), MAX_RECONNECT_DELAY);
        retriesRef.current++;
        setError(new Error("Connection lost, reconnecting..."));
        setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      doneRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [url]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, error, clearMessages };
}

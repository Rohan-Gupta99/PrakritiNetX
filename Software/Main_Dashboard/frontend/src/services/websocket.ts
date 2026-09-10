import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketHookProps {
  url?: string;
  onMessage?: (data: any) => void;
}

export const useWebSocket = ({ url = 'ws://localhost:8000/ws', onMessage }: WebSocketHookProps = {}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[EIN WS] Connected to Central Hub WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('[EIN WS Parse Error]', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[EIN WS] Disconnected. Reconnecting in 2s...');
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.error('[EIN WS Error]', err);
        ws.close();
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[EIN WS Setup Error]', e);
    }
  }, [url, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: string, payload: Record<string, any> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  return { isConnected, lastMessage, sendAction };
};

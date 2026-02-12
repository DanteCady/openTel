"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApiUrl, getWsUrl } from "@/lib/api";

export type AgentState = "available" | "busy" | "away" | "break";

export const STATE_LABELS: Record<AgentState, string> = {
  available: "Available",
  busy: "Busy",
  away: "Away",
  break: "Break",
};

export interface Session {
  tenantId: string;
  token: string;
  endpointId: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface IncomingCall {
  callId: string;
  fromEndpointId: string;
}

interface ActiveCall {
  callId: string;
  startedAt: number;
}

interface SessionContextValue {
  session: Session | null;
  setSession: (s: Session | null) => void;
  connectionStatus: ConnectionStatus;
  agentState: AgentState;
  setAgentState: (s: AgentState) => void;
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  connect: (s: Session) => void;
  disconnect: () => void;
  dial: (targetType: "endpoint" | "queue", targetId: string) => void;
  answerCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [agentState, setAgentState] = useState<AgentState>("available");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  wsRef.current = ws;

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    setWs(null);
    setSession(null);
    setConnectionStatus("idle");
    setIncomingCall(null);
    setActiveCall(null);
  }, []);

  const connect = useCallback((s: Session) => {
    const { token, endpointId, tenantId } = s;
    if (!token?.trim() || !endpointId?.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    setSession(s);
    setConnectionStatus("connecting");
    const socket = new WebSocket(`${getWsUrl()}/ws`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "auth", token: token.trim() }));
    };
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "auth_ok")
        socket.send(JSON.stringify({ type: "register", endpointId: endpointId.trim() }));
      if (msg.type === "registered") setConnectionStatus("connected");
      if (msg.type === "error") {
        setConnectionStatus("error");
      }
      if (msg.type === "incoming_call") {
        setIncomingCall({
          callId: msg.callId,
          fromEndpointId: msg.fromEndpointId ?? "unknown",
        });
      }
    };
    socket.onerror = () => setConnectionStatus("error");
    socket.onclose = () => {
      setConnectionStatus("idle");
      setWs(null);
    };
    setWs(socket);
  }, []);

  const updateAgentState = useCallback(async (state: AgentState) => {
    setAgentState(state);
    const s = session;
    if (!s?.tenantId || !s?.endpointId) return;
    try {
      const res = await fetch(
        `${getApiUrl()}/v1/tenants/${s.tenantId}/endpoints/${s.endpointId}/state`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s.token}`,
          },
          body: JSON.stringify({ agentState: state }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
    } catch {
      // toast in component
    }
  }, [session]);

  const dial = useCallback(
    (targetType: "endpoint" | "queue", targetId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const id = targetId.trim();
      if (!id) return;
      const payload =
        targetType === "queue"
          ? { type: "dial", toQueueId: id, metadata: {} }
          : { type: "dial", toEndpointId: id, metadata: {} };
      wsRef.current.send(JSON.stringify(payload));
    },
    []
  );

  const answerCall = useCallback(() => {
    if (!incomingCall || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "answer", callId: incomingCall.callId }));
    setActiveCall({ callId: incomingCall.callId, startedAt: Date.now() });
    setIncomingCall(null);
  }, [incomingCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "reject", callId: incomingCall.callId }));
    setIncomingCall(null);
  }, [incomingCall]);

  const hangUp = useCallback(() => {
    if (!activeCall || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "hangup", callId: activeCall.callId }));
    setActiveCall(null);
  }, [activeCall]);

  const value: SessionContextValue = {
    session,
    setSession,
    connectionStatus,
    agentState,
    setAgentState: updateAgentState,
    incomingCall,
    activeCall,
    connect,
    disconnect,
    dial,
    answerCall,
    rejectCall,
    hangUp,
    isAuthenticated: !!session,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

"use client";

import { useState, useRef, useCallback } from "react";
import {
  Button,
  Input,
  Card,
  makeStyles,
  Title3,
  Body1,
  Caption1,
} from "@fluentui/react-components";

const STUN_URL = "stun:localhost:3478";

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:3001";
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  return `ws://${host}:3001`;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    padding: "32px 24px 48px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: "24px",
  },
  title: {
    color: "var(--demo-text)",
    marginBottom: "4px",
  },
  subtitle: {
    color: "var(--demo-text-muted)",
    fontSize: "14px",
  },
  card: {
    marginBottom: "20px",
    backgroundColor: "var(--demo-surface)",
    border: "1px solid var(--demo-border)",
    borderRadius: "var(--demo-radius)",
    padding: "20px",
  },
  row: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "12px",
    ":last-child": { marginBottom: 0 },
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
  log: {
    marginTop: "8px",
  },
  status: {
    color: "var(--demo-text-muted)",
    fontSize: "13px",
    marginTop: "8px",
  },
  incoming: {
    color: "var(--demo-accent)",
    fontWeight: 600,
  },
});

export default function DevDemoPage() {
  const styles = useStyles();
  const [token, setToken] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [targetEndpointId, setTargetEndpointId] = useState("");
  const [incomingStatus, setIncomingStatus] = useState("Waiting for incoming call...");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [answerDisabled, setAnswerDisabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [fieldError, setFieldError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const weAreCallerRef = useRef<boolean>(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toISOString().slice(11, 19);
    setLogLines((prev) => [`${time} ${msg}`, ...prev].slice(0, 50));
  }, []);

  const connect = () => {
    const t = token.trim();
    const eid = endpointId.trim();
    setFieldError("");
    if (!t || !eid) {
      setFieldError("Enter token and endpoint ID (use UUID from pnpm opentel demo-setup).");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    const wsUrl = `${getWsUrl()}/ws`;
    log(`Connecting to ${wsUrl}...`);
    setConnectionStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const timeout = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        setConnectionStatus("error");
        setFieldError("Connection timed out. Is signaling running? Check http://127.0.0.1:3001/health");
        log("Connection timed out (10s)");
      }
    }, 10000);
    ws.onopen = () => {
      window.clearTimeout(timeout);
      log("WebSocket open, sending auth...");
      ws.send(JSON.stringify({ type: "auth", token: t }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        log(JSON.stringify(msg));
        if (msg.type === "auth_ok") {
          ws.send(JSON.stringify({ type: "register", endpointId: eid }));
        }
        if (msg.type === "registered") {
          setConnectionStatus("connected");
          log(`Registered as ${eid}`);
        }
        if (msg.type === "error") {
          setConnectionStatus("error");
          setFieldError(msg.message || "Server error");
        }
        if (msg.type === "incoming_call") {
          weAreCallerRef.current = false;
          currentCallIdRef.current = msg.callId;
          setIncomingStatus(`Incoming from ${msg.fromEndpointId}`);
          setAnswerDisabled(false);
        }
        if (msg.type === "call_created") {
          weAreCallerRef.current = true;
          currentCallIdRef.current = msg.callId;
        }
        if (msg.type === "answer" && weAreCallerRef.current) {
          const callId = currentCallIdRef.current;
          const ws = wsRef.current;
          if (!callId || !ws || ws.readyState !== WebSocket.OPEN || !msg.sdp) return;
          const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URL }] });
          peerConnectionRef.current = pc;
          pc.onicecandidate = (e) => {
            if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(JSON.stringify({ type: "ice", callId, candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid ?? null, sdpMLineIndex: e.candidate.sdpMLineIndex ?? null } }));
          };
          pc.ontrack = (e) => {
            if (e.streams[0]) log("Remote track received");
          };
          pc.onconnectionstatechange = () => log(`Caller PC: ${pc.connectionState}`);
          pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
            .then(() => pc.createAnswer())
            .then((answer) => {
              pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: "offer", callId, sdp: answer.sdp }));
              log("Sent answer to callee");
            })
            .catch((err) => log(`Caller setRemote/createAnswer: ${err.message}`));
        }
        if (msg.type === "offer" && !weAreCallerRef.current) {
          const pc = peerConnectionRef.current;
          if (!pc || !msg.sdp) return;
          pc.setRemoteDescription({ type: "answer", sdp: msg.sdp })
            .then(() => log("Set remote description (answer from caller)"))
            .catch((err) => log(`Callee setRemote: ${err.message}`));
        }
        if (msg.type === "ice" && msg.candidate) {
          const pc = peerConnectionRef.current;
          if (!pc) return;
          pc.addIceCandidate(msg.candidate).catch((err) => log(`addIceCandidate: ${err.message}`));
        }
      } catch (err) {
        log(`Error: ${err instanceof Error ? err.message : String(err)}`);
        setConnectionStatus("error");
      }
    };
    ws.onclose = () => {
      window.clearTimeout(timeout);
      setConnectionStatus(wsRef.current?.readyState === WebSocket.OPEN ? "connected" : "idle");
      log("Disconnected");
    };
    ws.onerror = () => {
      window.clearTimeout(timeout);
      setConnectionStatus("error");
      setFieldError("WebSocket failed. Is signaling running? Check http://127.0.0.1:3001/health");
      log("WebSocket error");
    };
  };

  const dial = () => {
    const target = targetEndpointId.trim();
    const ws = wsRef.current;
    setFieldError("");
    if (!target) {
      setFieldError("Enter the other endpoint ID (UUID) to dial.");
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setFieldError("Connect & Register first.");
      return;
    }
    weAreCallerRef.current = true;
    ws.send(JSON.stringify({ type: "dial", toEndpointId: target, metadata: { demo: "true" } }));
    log(`Dialing ${target}`);
  };

  const answer = () => {
    const callId = currentCallIdRef.current;
    const ws = wsRef.current;
    if (!callId || !ws || ws.readyState !== WebSocket.OPEN) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URL }] });
    peerConnectionRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: "ice", callId, candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid ?? null, sdpMLineIndex: e.candidate.sdpMLineIndex ?? null } }));
    };
    pc.ontrack = (e) => {
      if (e.streams[0]) log("Remote track received");
    };
    pc.onconnectionstatechange = () => log(`Callee PC: ${pc.connectionState}`);
    pc.createOffer()
      .then((offer) => {
        pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "answer", callId, sdp: offer.sdp }));
      })
      .catch((err) => log(`Answer createOffer: ${err.message}`));
    setAnswerDisabled(true);
    setIncomingStatus("Answered");
    log("Answered with offer");
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Title3 as="h1" className={styles.title}>
          OpenTel First Call
        </Title3>
        <Caption1 className={styles.subtitle}>
          Use two browser tabs — Tab 1 = Alice, Tab 2 = Bob. Paste token and endpoint ID (UUIDs) from <code>pnpm opentel demo-setup</code>.
        </Caption1>
      </header>

      {fieldError ? (
        <Card className={styles.card} style={{ borderColor: "var(--demo-error)", marginBottom: 16 }}>
          <Body1 style={{ color: "var(--demo-error)" }}>{fieldError}</Body1>
        </Card>
      ) : null}

      <Card className={styles.card}>
        <Title3 as="h2">1. Connect</Title3>
        <Body1 className={styles.status}>
          Token and your endpoint ID (UUID from demo-setup — not the label Alice/Bob).
        </Body1>
        {connectionStatus !== "idle" && (
          <Caption1 className={styles.status} style={{ marginTop: 4 }}>
            Status: {connectionStatus === "connecting" ? "Connecting…" : connectionStatus === "connected" ? "Connected" : "Error"}
          </Caption1>
        )}
        <div className={styles.row}>
          <Input
            className={styles.input}
            placeholder="Paste token"
            value={token}
            onChange={(_, d) => setToken(d.value)}
            type="password"
          />
        </div>
        <div className={styles.row}>
          <Input
            className={styles.input}
            placeholder="Endpoint ID"
            value={endpointId}
            onChange={(_, d) => setEndpointId(d.value)}
          />
          <Button appearance="primary" onClick={connect}>
            Connect & Register
          </Button>
        </div>
      </Card>

      <Card className={styles.card}>
        <Title3 as="h2">2. Call</Title3>
        <div className={styles.row}>
          <Input
            className={styles.input}
            placeholder="Other endpoint ID (to dial)"
            value={targetEndpointId}
            onChange={(_, d) => setTargetEndpointId(d.value)}
          />
          <Button appearance="primary" onClick={dial}>
            Dial
          </Button>
        </div>
      </Card>

      <Card className={styles.card}>
        <Title3 as="h2">3. Incoming / Answer</Title3>
        <Body1 className={styles.incoming}>{incomingStatus}</Body1>
        <div className={styles.row}>
          <Button appearance="primary" onClick={answer} disabled={answerDisabled}>
            Answer
          </Button>
        </div>
      </Card>

      <Card className={styles.card}>
        <Title3 as="h2">Events</Title3>
        <div className={`${styles.log} log-pre`}>
          {logLines.length === 0 ? "—" : logLines.join("\n")}
        </div>
      </Card>
    </div>
  );
}

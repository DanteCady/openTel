"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOff, User, Headphones } from "lucide-react";
import { toast } from "sonner";

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:3001";
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  return `ws://${host}:3001`;
}

export default function CcaasPage() {
  const [token, setToken] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [targetType, setTargetType] = useState<"endpoint" | "queue">("endpoint");
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [agentState, setAgentState] = useState<"available" | "busy" | "away" | "break">("available");
  const [incomingCall, setIncomingCall] = useState<{ callId: string; fromEndpointId: string } | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connect = () => {
    const t = token.trim();
    const eid = endpointId.trim();
    if (!t || !eid) {
      toast.error("Enter token and endpoint ID");
      return;
    }
    const url = `${getWsUrl()}/ws`;
    setStatus("connecting");
    const socket = new WebSocket(url);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "auth", token: t }));
    };
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "auth_ok") socket.send(JSON.stringify({ type: "register", endpointId: eid }));
      if (msg.type === "registered") {
        setStatus("connected");
        toast.success("Connected");
      }
      if (msg.type === "error") {
        setStatus("error");
        toast.error(msg.message);
      }
      if (msg.type === "incoming_call") {
        setIncomingCall({ callId: msg.callId, fromEndpointId: msg.fromEndpointId ?? "unknown" });
        toast.info("Incoming call");
      }
      if (msg.type === "call_created") toast.success("Call started");
    };
    socket.onerror = () => {
      setStatus("error");
      toast.error("Connection failed");
    };
    setWs(socket);
  };

  const dial = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error("Connect first");
      return;
    }
    const id = targetId.trim();
    if (!id) {
      toast.error("Enter target ID");
      return;
    }
    const payload =
      targetType === "queue"
        ? { type: "dial", toQueueId: id, metadata: {} }
        : { type: "dial", toEndpointId: id, metadata: {} };
    ws.send(JSON.stringify(payload));
  };

  const setState = async (state: "available" | "busy" | "away" | "break") => {
    setAgentState(state);
    const apiUrl =
      typeof window !== "undefined"
        ? `${window?.location?.protocol ?? "http:"}//${window?.location?.hostname ?? "localhost"}:3000`
        : "http://localhost:3000";
    try {
      const res = await fetch(
        `${apiUrl}/v1/tenants/${tenantId}/endpoints/${endpointId}/state`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ agentState: state }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(`State: ${state}`);
    } catch {
      toast.error("Failed to update state");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">OpenTel CCaaS</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Connect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Tenant ID"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
            <Input
              placeholder="Token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Input
              placeholder="Endpoint ID"
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
            />
            <Button onClick={connect} disabled={status === "connecting"}>
              {status === "connecting" ? "Connecting…" : "Connect"}
            </Button>
            {status === "connected" && (
              <span className="text-sm text-muted-foreground">Connected</span>
            )}
          </CardContent>
        </Card>

        {status === "connected" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5" /> Agent State
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                {(["available", "busy", "away", "break"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={agentState === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setState(s)}
                  >
                    {s}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" /> Dial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={targetType === "endpoint" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetType("endpoint")}
                  >
                    Endpoint
                  </Button>
                  <Button
                    variant={targetType === "queue" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetType("queue")}
                  >
                    Queue
                  </Button>
                </div>
                <Input
                  placeholder={targetType === "queue" ? "Queue ID" : "Endpoint ID"}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
                <Button onClick={dial}>
                  <Phone className="mr-2 h-4 w-4" /> Dial
                </Button>
              </CardContent>
            </Card>

            {incomingCall && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Incoming Call</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">From: {incomingCall.fromEndpointId}</p>
                  <div className="mt-4 flex gap-2">
                    <Button>
                      <Phone className="mr-2 h-4 w-4" /> Answer
                    </Button>
                    <Button variant="destructive">
                      <PhoneOff className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

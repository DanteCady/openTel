type EventCallback = (event: object) => void;

export interface OpenTelClientOptions {
  signalingUrl?: string;
  iceServers?: RTCIceServer[];
}

export class OpenTelClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private endpointId: string | null = null;
  private baseUrl: string;
  private iceServers: RTCIceServer[];
  private eventHandlers: EventCallback[] = [];

  constructor(opts: OpenTelClientOptions = {}) {
    this.baseUrl = opts.signalingUrl || "ws://localhost:3001";
    this.iceServers = opts.iceServers || [{ urls: "stun:localhost:3478" }];
  }

  connect(authToken: string): void {
    this.token = authToken;
    this.ws = new WebSocket(`${this.baseUrl}/ws`);
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type?.startsWith("call.") || msg.type?.startsWith("signaling.")) {
          this.eventHandlers.forEach((cb) => cb(msg));
        }
      } catch {}
    };
    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: "auth", token: authToken }));
    };
  }

  registerEndpoint(endpointId: string): void {
    this.endpointId = endpointId;
    const send = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "register", endpointId }));
      } else {
        setTimeout(send, 100);
      }
    };
    send();
  }

  dial(targetEndpointId: string, metadata?: Record<string, string>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected");
    this.ws.send(JSON.stringify({ type: "dial", toEndpointId: targetEndpointId, metadata: metadata ?? {} }));
  }

  answer(callId: string, sdp: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected");
    this.ws.send(JSON.stringify({ type: "answer", callId, sdp }));
  }

  hangup(callId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected");
    this.ws.send(JSON.stringify({ type: "hangup", callId }));
  }

  sendIceCandidate(callId: string, candidate: RTCIceCandidateInit): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected");
    this.ws.send(JSON.stringify({ type: "ice", callId, candidate }));
  }

  sendOffer(callId: string, sdp: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected");
    this.ws.send(JSON.stringify({ type: "offer", callId, sdp }));
  }

  onEvent(cb: EventCallback): () => void {
    this.eventHandlers.push(cb);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== cb);
    };
  }

  createPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({ iceServers: this.iceServers });
  }
}

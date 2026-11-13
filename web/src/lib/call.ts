import { apiWsUrl } from "./api";

export type CallStatus = "idle" | "connecting" | "waiting" | "incoming" | "active" | "ended" | "failed";

interface CallHandlers {
  onStatus: (status: CallStatus, detail?: string) => void;
  onPeers?: (count: number) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
];

/**
 * Одна WebRTC-сессия: сигналинг по WebSocket (/api/calls/ws/{room}),
 * звук — через RTCPeerConnection. Комната рассчитана на двух участников.
 */
export class CallSession {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private closed = false;
  private canInitiate = false;
  private offerSent = false;

  constructor(private handlers: CallHandlers) {}

  async start(room: string): Promise<void> {
    this.closed = false;
    this.handlers.onStatus("connecting");
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      this.handlers.onStatus("failed", "Нет доступа к микрофону");
      return;
    }

    const socket = new WebSocket(apiWsUrl(`/calls/ws/${encodeURIComponent(room)}`));
    this.ws = socket;
    socket.onmessage = (event) => void this.onMessage(event);
    socket.onerror = () => {
      if (!this.closed) this.handlers.onStatus("failed", "Сигнальный сервер недоступен");
    };
    socket.onclose = () => {
      if (!this.closed) this.handlers.onStatus("ended");
    };

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 8000);
      socket.addEventListener("open", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    if (socket.readyState === WebSocket.OPEN) this.handlers.onStatus("waiting");
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  hangUp(): void {
    this.send({ type: "hangup" });
    this.close();
  }

  close(): void {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      /* уже закрыт */
    }
    this.ws = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }
    this.handlers.onStatus("ended");
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    let payload: { type?: string; peers?: number; count?: number; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; detail?: string };
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (payload.type === "ready") {
      this.canInitiate = (payload.peers ?? 1) <= 1;
      this.handlers.onPeers?.(payload.peers ?? 1);
      return;
    }
    if (payload.type === "peers") {
      const count = payload.count ?? 0;
      this.handlers.onPeers?.(count);
      if (count >= 2 && this.canInitiate && !this.offerSent) await this.createOffer();
      return;
    }
    if (payload.type === "offer" && payload.sdp) {
      await this.acceptOffer(payload.sdp);
      return;
    }
    if (payload.type === "answer" && payload.sdp && this.pc) {
      await this.pc.setRemoteDescription(payload.sdp);
      if (this.pc.connectionState === "connected") this.handlers.onStatus("active");
      return;
    }
    if (payload.type === "ice" && payload.candidate && this.pc) {
      try {
        await this.pc.addIceCandidate(payload.candidate);
      } catch {
        /* кандидат устарел — не критично */
      }
      return;
    }
    if (payload.type === "hangup") {
      this.handlers.onStatus("ended");
      this.close();
      return;
    }
    if (payload.type === "error") {
      this.handlers.onStatus("failed", payload.detail);
    }
  }

  private ensurePeer(): RTCPeerConnection {
    if (this.pc) return this.pc;
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.onicecandidate = (event) => {
      if (event.candidate) this.send({ type: "ice", candidate: event.candidate });
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.playRemote(stream);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") this.handlers.onStatus("active");
      if (peer.connectionState === "failed") this.handlers.onStatus("failed", "Соединение не установлено");
      if (peer.connectionState === "disconnected" || peer.connectionState === "closed") {
        if (!this.closed) this.handlers.onStatus("ended");
      }
    };
    this.localStream?.getTracks().forEach((track) => peer.addTrack(track, this.localStream as MediaStream));
    this.pc = peer;
    return peer;
  }

  private async createOffer(): Promise<void> {
    this.offerSent = true;
    const peer = this.ensurePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.send({ type: "offer", sdp: peer.localDescription });
  }

  private async acceptOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    this.handlers.onStatus("incoming");
    const peer = this.ensurePeer();
    if (peer.signalingState !== "stable") return;
    await peer.setRemoteDescription(sdp);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    this.send({ type: "answer", sdp: peer.localDescription });
  }

  private playRemote(stream: MediaStream): void {
    if (!this.audio) {
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.setAttribute("playsinline", "true");
      this.audio.style.display = "none";
      document.body.appendChild(this.audio);
    }
    this.audio.srcObject = stream;
    void this.audio.play().catch(() => undefined);
    this.handlers.onStatus("active");
  }
}

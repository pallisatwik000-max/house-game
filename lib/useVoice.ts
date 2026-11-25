"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase-browser";

export type Role = "admin" | "player";
export type Person = { id: string; name: string; role: Role; micOn: boolean };

type Signal = {
  to: string;
  from: string;
  kind: "offer" | "answer" | "ice";
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

// Voice chat: everyone connects to everyone (mesh) with WebRTC.
// Supabase Realtime is used only to exchange connection messages
// and to keep the participant list.
export function useVoice(gameId: string | null) {
  const [status, setStatus] = useState<"off" | "asking" | "connecting" | "on">("off");
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [myId, setMyId] = useState("");

  const idRef = useRef("");
  const meRef = useRef<Person | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(
    new Map<string, { pc: RTCPeerConnection; audio: HTMLAudioElement }>()
  );
  const pendingRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const presentRef = useRef(new Set<string>());
  const speakerRef = useRef(true);
  const leavingRef = useRef(false);
  const leaveRef = useRef<() => void>(() => {});

  function setLink(id: string, state: string | null) {
    setLinks((prev) => {
      const next = { ...prev };
      if (state === null) delete next[id];
      else next[id] = state;
      return next;
    });
  }

  function send(to: string, kind: Signal["kind"], data: Signal["data"]) {
    chanRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { to, from: idRef.current, kind, data } satisfies Signal,
    });
  }

  function closePeer(id: string) {
    const p = peersRef.current.get(id);
    if (p) {
      try {
        p.pc.close();
      } catch {}
      p.audio.srcObject = null;
      p.audio.remove();
      peersRef.current.delete(id);
    }
    pendingRef.current.delete(id);
  }

  function scheduleRetry(id: string) {
    setTimeout(() => {
      if (leavingRef.current) return;
      const p = peersRef.current.get(id);
      if (!p || !presentRef.current.has(id)) return;
      if (p.pc.connectionState === "connected") return;
      // Only the side with the bigger id starts a new call (avoids clashes)
      if (idRef.current > id) callPeer(id);
    }, 3000);
  }

  function makePc(id: string) {
    closePeer(id);
    const pc = new RTCPeerConnection(ICE);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.muted = !speakerRef.current;
    document.body.appendChild(audio);

    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) send(id, "ice", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setLink(id, "connected");
      else if (s === "failed" || s === "disconnected") {
        setLink(id, "reconnecting");
        scheduleRetry(id);
      } else setLink(id, "connecting");
    };

    peersRef.current.set(id, { pc, audio });
    setLink(id, "connecting");
    return pc;
  }

  async function callPeer(id: string) {
    try {
      const pc = makePc(id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send(id, "offer", offer);
    } catch {
      setLink(id, "reconnecting");
      scheduleRetry(id);
    }
  }

  async function flushIce(id: string, pc: RTCPeerConnection) {
    const list = pendingRef.current.get(id) ?? [];
    pendingRef.current.delete(id);
    for (const c of list) await pc.addIceCandidate(c).catch(() => {});
  }

  async function onSignal(sig: Signal) {
    if (sig.to !== idRef.current) return;
    const { from, kind, data } = sig;
    try {
      if (kind === "offer") {
        const pc = makePc(from);
        await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
        await flushIce(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send(from, "answer", answer);
      } else if (kind === "answer") {
        const p = peersRef.current.get(from);
        if (p && p.pc.signalingState === "have-local-offer") {
          await p.pc.setRemoteDescription(data as RTCSessionDescriptionInit);
          await flushIce(from, p.pc);
        }
      } else if (kind === "ice") {
        const p = peersRef.current.get(from);
        if (p && p.pc.remoteDescription) {
          await p.pc.addIceCandidate(data as RTCIceCandidateInit).catch(() => {});
        } else {
          const list = pendingRef.current.get(from) ?? [];
          list.push(data as RTCIceCandidateInit);
          pendingRef.current.set(from, list);
        }
      }
    } catch {
      setLink(from, "reconnecting");
    }
  }

  function applyMic(next: boolean) {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    if (meRef.current) {
      meRef.current = { ...meRef.current, micOn: next };
      chanRef.current?.track(meRef.current).catch(() => {});
    }
  }

  function onSync(ch: RealtimeChannel) {
    const state = ch.presenceState() as unknown as Record<string, Person[]>;
    const seen = new Set<string>();
    const list: Person[] = [];
    Object.values(state).forEach((arr) =>
      arr.forEach((p) => {
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id);
          list.push({ id: p.id, name: p.name, role: p.role, micOn: p.micOn });
        }
      })
    );
    setPeople(list);
    presentRef.current = seen;

    // Drop connections to people who left
    Array.from(peersRef.current.keys()).forEach((id) => {
      if (!seen.has(id)) {
        closePeer(id);
        setLink(id, null);
      }
    });

    // Call everyone new. Only the bigger id calls, so no double calls.
    list.forEach((p) => {
      if (p.id !== idRef.current && !peersRef.current.has(p.id) && idRef.current > p.id) {
        callPeer(p.id);
      }
    });
  }

  async function join(name: string, role: Role) {
    if (!gameId || status !== "off") return;
    setError("");
    setStatus("asking");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice chat needs a secure (https) page and a supported browser.");
      setStatus("off");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError(
        "Microphone permission was denied. Allow the microphone in your browser settings and try again."
      );
      setStatus("off");
      return;
    }

    streamRef.current = stream;
    leavingRef.current = false;
    const id = crypto.randomUUID();
    idRef.current = id;
    setMyId(id);
    meRef.current = { id, name, role, micOn: true };
    setMicOn(true);
    setStatus("connecting");

    const ch = supabaseBrowser().channel(`voice:${gameId}`, {
      config: { presence: { key: id }, broadcast: { self: false } },
    });
    chanRef.current = ch;

    ch.on("presence", { event: "sync" }, () => onSync(ch));
    ch.on("broadcast", { event: "signal" }, ({ payload }) => {
      onSignal(payload as Signal);
    });
    ch.on("broadcast", { event: "mod" }, ({ payload }) => {
      const p = payload as { to: string; action: string; fromRole: string };
      if (p.to !== idRef.current || p.fromRole !== "admin") return;
      if (p.action === "mute") applyMic(false);
      if (p.action === "kick") {
        setError("The Admin removed you from voice chat.");
        leaveRef.current();
      }
    });

    // This runs again after every automatic reconnection,
    // so we re-announce ourselves each time.
    ch.subscribe(async (st) => {
      if (leavingRef.current) return;
      if (st === "SUBSCRIBED") {
        await ch.track(meRef.current!).catch(() => {});
        setStatus("on");
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
        setStatus("connecting");
      }
    });
  }

  function leave() {
    leavingRef.current = true;
    Array.from(peersRef.current.keys()).forEach((id) => closePeer(id));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ch = chanRef.current;
    chanRef.current = null;
    if (ch) {
      ch.untrack().catch(() => {});
      supabaseBrowser().removeChannel(ch);
    }
    presentRef.current = new Set();
    setPeople([]);
    setLinks({});
    setMyId("");
    setStatus("off");
  }
  leaveRef.current = leave;

  function toggleMic() {
    applyMic(!micOn);
  }

  function toggleSpeaker() {
    const next = !speakerOn;
    speakerRef.current = next;
    setSpeakerOn(next);
    peersRef.current.forEach((p) => (p.audio.muted = !next));
  }

  // Admin only: mute someone or remove them from voice chat
  function moderate(targetId: string, action: "mute" | "kick") {
    if (meRef.current?.role !== "admin") return;
    chanRef.current?.send({
      type: "broadcast",
      event: "mod",
      payload: { to: targetId, action, fromRole: "admin" },
    });
  }

  // Leave voice when the game changes or the page closes
  useEffect(() => {
    return () => {
      if (chanRef.current || streamRef.current) leaveRef.current();
    };
  }, [gameId]);

  return {
    status,
    error,
    micOn,
    speakerOn,
    people,
    links,
    myId,
    join,
    leave,
    toggleMic,
    toggleSpeaker,
    moderate,
  };
      }

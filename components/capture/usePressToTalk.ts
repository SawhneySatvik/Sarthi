"use client";

import { useEffect, useRef, useState } from "react";

import { MAX_VOICE_DURATION_MS, isVoiceMimeType } from "@/core/voice";

export type RecorderState = "idle" | "requesting" | "recording" | "tap-to-stop" | "unsupported" | "denied";

interface PressToTalkOptions {
  onAudio: (file: File, durationMs: number) => void;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Browser-only recorder state machine. It owns only an in-memory File; no upload is
 * possible here. The caller decides when the resulting clip is sent to the STT route.
 */
export function usePressToTalk({ onAudio }: PressToTalkOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const capTimeoutRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const mountedRef = useRef(true);
  const requestingRef = useRef(false);
  const pendingReleaseRef = useRef<"tap" | "stop" | null>(null);

  function clearTimers() {
    if (capTimeoutRef.current !== null) window.clearTimeout(capTimeoutRef.current);
    if (elapsedIntervalRef.current !== null) window.clearInterval(elapsedIntervalRef.current);
    capTimeoutRef.current = null;
    elapsedIntervalRef.current = null;
  }

  function finish(discard = false) {
    discardRef.current = discard;
    if (requestingRef.current && !recorderRef.current) {
      pendingReleaseRef.current = "stop";
      if (mountedRef.current) setState("idle");
      return;
    }
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    stopTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    if (mountedRef.current) setState("idle");
  }

  async function start() {
    if (recorderRef.current || state === "requesting") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    discardRef.current = false;
    pendingReleaseRef.current = null;
    setElapsedMs(0);
    setState("requesting");
    requestingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      requestingRef.current = false;
      if (!mountedRef.current) {
        stopTracks(stream);
        return;
      }
      streamRef.current = stream;
      if (pendingReleaseRef.current === "stop") {
        stopTracks(stream);
        streamRef.current = null;
        return;
      }
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const durationMs = Math.min(MAX_VOICE_DURATION_MS, Math.max(1, Date.now() - startedAtRef.current));
        // MediaRecorder often appends a codecs parameter; the STT port intentionally
        // accepts the stable transport MIME only, so normalise before constructing the
        // ephemeral File that is posted to the server.
        const mimeType = (recorder.mimeType || "audio/webm").split(";", 1)[0] ?? "audio/webm";
        const file = isVoiceMimeType(mimeType)
          ? new File(chunks, "capture.webm", { type: mimeType })
          : null;
        clearTimers();
        stopTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        if (mountedRef.current) setState("idle");
        if (!discardRef.current && file) onAudio(file, durationMs);
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setState("recording");
      elapsedIntervalRef.current = window.setInterval(() => {
        if (mountedRef.current) setElapsedMs(Math.min(MAX_VOICE_DURATION_MS, Date.now() - startedAtRef.current));
      }, 250);
      capTimeoutRef.current = window.setTimeout(() => finish(false), MAX_VOICE_DURATION_MS);
      if (pendingReleaseRef.current === "tap") setState("tap-to-stop");
    } catch {
      requestingRef.current = false;
      stopTracks(streamRef.current);
      streamRef.current = null;
      if (mountedRef.current) setState("denied");
    }
  }

  function enableTapToStop() {
    if (state === "recording") setState("tap-to-stop");
  }

  function release(quick: boolean) {
    if (requestingRef.current && !recorderRef.current) {
      pendingReleaseRef.current = quick ? "tap" : "stop";
      return;
    }
    if (state === "tap-to-stop") finish(false);
    else if (quick) enableTapToStop();
    else finish(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      finish(true);
    };
    // `finish` only touches refs and browser timers; cleanup must run once on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, elapsedMs, start, finish, release };
}

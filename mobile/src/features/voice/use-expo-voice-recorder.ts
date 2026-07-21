import { useCallback, useEffect, useRef, useState } from "react";

import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Haptics from "expo-haptics";

import { MAX_VOICE_DURATION_MS } from "@core/voice";
import type { VoiceAudio } from "@contracts";

export type ExpoVoiceState = "idle" | "requesting" | "recording" | "denied" | "error";

export interface ExpoVoiceRecorderOptions {
  readonly onAudio: (audio: VoiceAudio) => void | Promise<void>;
  readonly onRecordingStart?: () => void;
  readonly onError?: (message: string) => void;
}

/**
 * PTT adapter for Expo SDK 57. It uses expo-audio's documented HIGH_QUALITY M4A/AAC
 * recorder path, then converts the temporary cache URI to transient bytes for the
 * injected VoiceProvider. No recording URI is persisted by this hook.
 */
export function useExpoVoiceRecorder({ onAudio, onRecordingStart, onError }: ExpoVoiceRecorderOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [state, setState] = useState<ExpoVoiceState>("idle");
  const startedAt = useRef<number | null>(null);
  const active = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const clearStopTimer = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const finish = useCallback(async () => {
    if (!active.current) return;
    clearStopTimer();
    active.current = false;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const elapsed = startedAt.current === null ? 1 : Math.max(1, Math.min(MAX_VOICE_DURATION_MS, Date.now() - startedAt.current));
      startedAt.current = null;
      if (!uri) throw new Error("recording URI unavailable");
      const response = await fetch(uri);
      if (!response.ok) throw new Error("recording bytes unavailable");
      await Haptics.selectionAsync();
      await onAudio({ bytes: new Uint8Array(await response.arrayBuffer()), mimeType: "audio/mp4", durationMs: elapsed });
      if (mounted.current) setState("idle");
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (mounted.current) setState("error");
      onError?.("Couldn’t prepare that recording. Try again.");
    }
  }, [clearStopTimer, onAudio, onError, recorder]);

  const start = useCallback(async () => {
    if (active.current || state === "requesting") return;
    if (mounted.current) setState("requesting");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        if (mounted.current) setState("denied");
        onError?.("Microphone access is needed for voice capture.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      active.current = true;
      await Haptics.selectionAsync();
      if (mounted.current) setState("recording");
      onRecordingStart?.();
      timeout.current = setTimeout(() => { void finish(); }, MAX_VOICE_DURATION_MS);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (mounted.current) setState("error");
      onError?.("Couldn’t start the microphone. Try again.");
    }
  }, [finish, onError, onRecordingStart, recorder, state]);

  const cancel = useCallback(async () => {
    clearStopTimer();
    active.current = false;
    startedAt.current = null;
    try {
      if (recorderState.isRecording) await recorder.stop();
    } finally {
      if (mounted.current) setState("idle");
    }
  }, [clearStopTimer, recorder, recorderState.isRecording]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearStopTimer();
      if (active.current) void recorder.stop();
    };
  }, [clearStopTimer, recorder]);

  return { state, isRecording: recorderState.isRecording, start, finish, cancel, maxDurationMs: MAX_VOICE_DURATION_MS };
}

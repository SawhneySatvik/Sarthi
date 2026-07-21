import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { blockedProposalIds, isAcceptAllEligible } from "@core/capture/route";
import type { Proposal } from "@core/capture/contract";
import { useSarthiTheme } from "@mobile/theme";

import { useExpoVoiceRecorder } from "@mobile/features/voice";

import { domainLabel, formatPrimary, proposalDisplay, toStoredInteger } from "./proposal";
import { useCaptureController, type CaptureController } from "./use-capture-controller";
import { CAPTURE_DOMAINS, type CaptureCard, type CaptureRuntime } from "./types";

export interface CaptureSheetProps {
  readonly runtime: CaptureRuntime;
  readonly initialText?: string;
  readonly prompt?: string;
  /** Lets an embedding screen pass its known accessibility preference without re-querying. */
  readonly reducedMotion?: boolean;
  readonly onClose?: () => void;
}

function useReducedMotionPreference(explicit: boolean | undefined): boolean {
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    if (explicit !== undefined) return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setSystemReduced(value);
    });
    const listener = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setSystemReduced);
    return () => {
      active = false;
      listener?.remove();
    };
  }, [explicit]);
  return explicit ?? systemReduced;
}

function ActionButton({
  label,
  onPress,
  tone = "quiet",
  disabled = false,
  hint,
}: {
  readonly label: string;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly tone?: "quiet" | "strong" | "danger";
  readonly disabled?: boolean;
  readonly hint?: string;
}) {
  const { theme } = useSarthiTheme();
  const backgroundColor = tone === "strong" ? theme.colors.ink1 : tone === "danger" ? theme.colors.danger : theme.colors.raised;
  const color = tone === "strong" ? theme.colors.canvas : theme.colors.ink1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor,
        borderColor: tone === "quiet" ? theme.colors.line : backgroundColor,
        borderRadius: theme.radius.input,
        borderWidth: theme.border.hairline,
        justifyContent: "center",
        minHeight: theme.layout.hitTarget,
        opacity: disabled ? theme.motion.fast / theme.motion.slow : pressed ? theme.motion.fast / theme.motion.base : 1,
        paddingHorizontal: theme.spacing.md,
      })}>
      <Text style={[theme.typography.body, { color }]}>{label}</Text>
    </Pressable>
  );
}

function DomainChip({ domain }: { readonly domain: Proposal["domain"] }) {
  const { theme } = useSarthiTheme();
  const color = theme.colors[domain];
  return (
    <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: color, borderRadius: theme.radius.chip, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xxs }}>
      <Text style={[theme.typography.caption, { color: theme.colors.canvas }]}>{domainLabel(domain)}</Text>
    </View>
  );
}

function VoiceOrb({ controller, reducedMotion }: { readonly controller: CaptureController; readonly reducedMotion: boolean }) {
  const { theme } = useSarthiTheme();
  const voice = useExpoVoiceRecorder({
    onAudio: controller.transcribe,
    onRecordingStart: controller.markRecording,
  });
  const listening = voice.state === "recording" || voice.state === "requesting";
  const label = listening ? "Release to transcribe" : "Hold to talk";
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Hold while speaking, then release to review the transcript before it is parsed."
        onPressIn={() => { void voice.start(); }}
        onPressOut={() => { void voice.finish(); }}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: listening ? theme.colors.health : theme.colors.card,
          borderColor: listening ? theme.colors.healthStrong : theme.colors.line,
          borderRadius: theme.radius.chip,
          borderWidth: theme.border.hairline,
          height: theme.spacing.xxl * 2,
          justifyContent: "center",
          opacity: pressed ? theme.motion.fast / theme.motion.base : 1,
          width: theme.spacing.xxl * 2,
          ...theme.shadows.card,
        })}>
        <View style={{ alignItems: "center", backgroundColor: theme.colors.raised, borderRadius: theme.radius.chip, height: theme.layout.captureTarget, justifyContent: "center", width: theme.layout.captureTarget }}>
          <Text accessibilityElementsHidden style={[theme.typography.display, { color: theme.colors.ink1 }]}>{listening && !reducedMotion ? "◉" : "●"}</Text>
        </View>
      </Pressable>
      <Text style={[theme.typography.caption, { color: voice.state === "error" || voice.state === "denied" ? theme.colors.warn : theme.colors.ink3 }]}>
        {voice.state === "denied" ? "Microphone permission is off" : voice.state === "error" ? "Voice capture needs a retry" : label}
      </Text>
    </View>
  );
}

function InputPane({ controller, reducedMotion }: { readonly controller: CaptureController; readonly reducedMotion: boolean }) {
  const { theme } = useSarthiTheme();
  const seeds = ["log a meal", "add expense", "did a session", "skipped something", "weigh-in", "receipt"];
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const pickPhoto = async (photoType: "meal" | "receipt") => {
    setPhotoMessage(null);
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 1 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const mimeType = asset?.mimeType;
    if (!asset?.base64 || (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp")) {
      setPhotoMessage("Choose a JPEG, PNG, or WebP image so it can stay reviewable.");
      return;
    }
    try {
      const binary = globalThis.atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      await controller.submitPhoto({ bytes, mimeType, filename: asset.fileName ?? undefined }, photoType, controller.state.rawText || null);
    } catch {
      setPhotoMessage("Couldn’t prepare that photo. Nothing was saved.");
    }
  };
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text style={[theme.typography.title, { color: theme.colors.ink1 }]}>What happened?</Text>
      <VoiceOrb controller={controller} reducedMotion={reducedMotion} />
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
        <TextInput
          accessibilityLabel="Capture text"
          multiline
          onChangeText={controller.setText}
          onSubmitEditing={() => { void controller.submitText(); }}
          placeholder="Type a messy life update…"
          placeholderTextColor={theme.colors.ink3}
          style={[theme.typography.coach, {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.line,
            borderRadius: theme.radius.input,
            borderWidth: theme.border.hairline,
            color: theme.colors.ink1,
            flex: 1,
            minHeight: theme.layout.captureTarget,
            padding: theme.spacing.sm,
          }]}
          value={controller.state.rawText}
        />
        <ActionButton label="Send" onPress={() => { void controller.submitText(); }} tone="strong" />
      </View>
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
        <View style={{ flex: 1 }}><ActionButton label="Meal photo" onPress={() => { void pickPhoto("meal"); }} /></View>
        <View style={{ flex: 1 }}><ActionButton label="Receipt photo" onPress={() => { void pickPhoto("receipt"); }} /></View>
      </View>
      {photoMessage ? <Text style={[theme.typography.caption, { color: theme.colors.warn }]}>{photoMessage}</Text> : null}
      <ScrollView horizontal contentContainerStyle={{ gap: theme.spacing.xs }} showsHorizontalScrollIndicator={false}>
        {seeds.map((seed) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Use ${seed} as a capture hint`}
            key={seed}
            onPress={() => controller.setText(`${seed}: `)}
            style={({ pressed }) => ({
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.line,
              borderRadius: theme.radius.chip,
              borderWidth: theme.border.hairline,
              opacity: pressed ? theme.motion.fast / theme.motion.base : 1,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs,
            })}>
            <Text style={[theme.typography.caption, { color: theme.colors.ink2 }]}>{seed}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>Nothing is saved until its route is safe or you explicitly accept it.</Text>
    </View>
  );
}

function ParsingPane({ text, label }: { readonly text: string; readonly label: string }) {
  const { theme } = useSarthiTheme();
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLiveRegion="polite">
      <Text style={[theme.typography.coach, { color: theme.colors.ink2 }]}>“{text}”</Text>
      <Text style={[theme.typography.body, { color: theme.colors.ink2 }]}>{label}</Text>
      {["first", "second", "third"].map((key) => <View key={key} style={{ backgroundColor: theme.colors.line, borderRadius: theme.radius.card, height: theme.layout.hitTarget }} />)}
    </View>
  );
}

function TranscriptPane({ controller }: { readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  const lowConfidence = controller.state.transcriptConfidenceBps !== null && controller.state.transcriptConfidenceBps < 9000;
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>WHAT SARTHI HEARD</Text>
        <Text style={[theme.typography.caption, { color: lowConfidence ? theme.colors.warn : theme.colors.ink3 }]}>
          {controller.state.transcriptConfidenceBps === null ? "Confidence unavailable" : `${Math.round(controller.state.transcriptConfidenceBps / 100)}% confidence`}
        </Text>
      </View>
      <TextInput
        accessibilityLabel="Voice transcript, edit before parsing"
        multiline
        onChangeText={controller.setTranscript}
        style={[theme.typography.coach, { backgroundColor: theme.colors.canvas, borderColor: lowConfidence ? theme.colors.warn : theme.colors.line, borderRadius: theme.radius.input, borderWidth: theme.border.hairline, color: theme.colors.ink1, minHeight: theme.spacing.xxl * 2, padding: theme.spacing.sm }]}
        value={controller.state.transcript}
      />
      <ActionButton label="Parse transcript" onPress={() => { void controller.confirmTranscript(); }} tone="strong" />
    </View>
  );
}

function FiledStrip({ controller }: { readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  if (controller.state.filed.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>FILED AUTOMATICALLY</Text>
        {controller.state.lastCommit?.source === "auto" ? <ActionButton label="Undo" onPress={() => { void controller.undoLatest(); }} hint="Undo the latest automatic capture batch" /> : null}
      </View>
      {controller.state.filed.map((proposal) => {
        const view = proposalDisplay(proposal);
        return (
          <View key={proposal.proposalId} style={{ alignItems: "center", borderColor: theme.colors.line, borderTopWidth: theme.border.hairline, flexDirection: "row", gap: theme.spacing.xs, paddingVertical: theme.spacing.xs }}>
            <Text style={[theme.typography.body, { color: theme.colors.ok }]}>✓</Text>
            <View style={{ flex: 1 }}><Text style={[theme.typography.body, { color: theme.colors.ink2 }]} numberOfLines={1}>{view.title}</Text></View>
            <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>{formatPrimary(view.primary)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function EstimateCard({ card, controller }: { readonly card: CaptureCard; readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  const proposal = card.proposal;
  const display = proposalDisplay(proposal);
  const [value, setValue] = useState(display.primary?.displayValue === null || display.primary === null ? "" : String(display.primary.displayValue));
  const isWhy = controller.state.whyProposalId === proposal.proposalId;
  const isEditing = controller.state.editingProposalId === proposal.proposalId;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > theme.spacing.lg,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > theme.layout.captureTarget) void controller.accept(proposal);
      if (gesture.dx < -theme.layout.captureTarget) controller.discard(proposal.proposalId);
    },
  }), [controller, proposal, theme.layout.captureTarget, theme.spacing.lg]);

  if (isWhy) {
    return (
      <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.line, borderRadius: theme.radius.card, borderWidth: theme.border.hairline, gap: theme.spacing.md, padding: theme.spacing.card, ...theme.shadows.card }}>
        <Text style={[theme.typography.coach, { color: theme.colors.ink1 }]}>Why this number</Text>
        <Text style={[theme.typography.body, { color: theme.colors.ink2 }]}>{proposal.why.basis}</Text>
        {proposal.why.assumptions.map((assumption) => <Text key={assumption} style={[theme.typography.caption, { color: theme.colors.ink3 }]}>• {assumption}</Text>)}
        {card.reasons.map((reason) => <Text key={reason} style={[theme.typography.caption, { color: theme.colors.warn }]}>• {reason}</Text>)}
        <ActionButton label="Back to card" onPress={() => controller.setWhy(null)} />
      </View>
    );
  }

  const saveEdit = () => {
    if (!display.primary) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    void controller.acceptEdited(proposal, { [display.primary.payloadKey]: toStoredInteger(display.primary, numeric) });
  };

  return (
    <View {...panResponder.panHandlers} style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.line, borderRadius: theme.radius.card, borderWidth: theme.border.hairline, gap: theme.spacing.md, padding: theme.spacing.card, ...theme.shadows.card }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <DomainChip domain={proposal.domain} />
        <Text accessibilityLabel={`${Math.round(proposal.confidenceBps / 100)} percent confidence`} style={[theme.typography.caption, { color: proposal.confidenceBps >= 9000 ? theme.colors.ok : proposal.confidenceBps >= 5000 ? theme.colors.warn : theme.colors.danger }]}>
          {Math.round(proposal.confidenceBps / 100)}%
        </Text>
      </View>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text style={[theme.typography.display, { color: theme.colors.ink1 }]}>{formatPrimary(display.primary) ?? display.status}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.ink2 }]}>{display.title}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>{display.detail}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Change proposal domain" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {CAPTURE_DOMAINS.map((domain) => (
          <Pressable key={domain} accessibilityRole="radio" accessibilityState={{ selected: proposal.domain === domain }} onPress={() => controller.setDomain(proposal.proposalId, domain)} style={{ borderColor: proposal.domain === domain ? theme.colors[domain] : theme.colors.line, borderRadius: theme.radius.chip, borderWidth: theme.border.hairline, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xxs }}>
            <Text style={[theme.typography.caption, { color: proposal.domain === domain ? theme.colors[domain] : theme.colors.ink3 }]}>{domainLabel(domain)}</Text>
          </Pressable>
        ))}
      </View>
      {isEditing && display.primary ? (
        <View style={{ gap: theme.spacing.xs }}>
          <TextInput accessibilityLabel={`${display.primary.label} value`} keyboardType="decimal-pad" onChangeText={setValue} style={[theme.typography.body, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.line, borderRadius: theme.radius.input, borderWidth: theme.border.hairline, color: theme.colors.ink1, minHeight: theme.layout.hitTarget, paddingHorizontal: theme.spacing.sm }]} value={value} />
          <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
            <View style={{ flex: 1 }}><ActionButton label="Save & accept" onPress={saveEdit} tone="strong" /></View>
            <View style={{ flex: 1 }}><ActionButton label="Cancel" onPress={() => controller.setEditing(null)} /></View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
          <View style={{ flex: 1 }}><ActionButton label="Discard" onPress={() => controller.discard(proposal.proposalId)} tone="danger" hint="Discard this proposal without saving it" /></View>
          <View style={{ flex: 1 }}><ActionButton label="Edit" onPress={() => controller.setEditing(proposal.proposalId)} /></View>
          <View style={{ flex: 1 }}><ActionButton label="Accept" onPress={() => { void controller.accept(proposal); }} tone="strong" hint="Accept and write this typed entry" /></View>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Why this number" onPress={() => controller.setWhy(proposal.proposalId)}>
        <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>Why this number?</Text>
      </Pressable>
    </View>
  );
}

function Deck({ controller }: { readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  const top = controller.state.deck[0];
  if (!top) return null;
  const eligible = isAcceptAllEligible(controller.state.deck.map((card) => card.proposal), blockedProposalIds({ questions: controller.state.questions }));
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>{`${controller.state.deck.length} pending review`}</Text>
      <EstimateCard card={top} controller={controller} />
      {controller.state.deck.slice(1, 3).map((card) => <View key={card.proposal.proposalId} style={{ backgroundColor: theme.colors.raised, borderColor: theme.colors.line, borderRadius: theme.radius.card, borderWidth: theme.border.hairline, padding: theme.spacing.sm }}><Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>{proposalDisplay(card.proposal).title}</Text></View>)}
      {top.question ? <View style={{ backgroundColor: theme.colors.raised, borderRadius: theme.radius.input, padding: theme.spacing.sm }}><Text style={[theme.typography.body, { color: theme.colors.ink1 }]}>{top.question.prompt}</Text></View> : null}
      {eligible ? <ActionButton label={`Accept all ${controller.state.deck.length}`} onPress={() => { void controller.acceptAll(); }} tone="strong" /> : null}
    </View>
  );
}

function Fanout({ controller }: { readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  const all = [...controller.state.filed, ...controller.state.accepted];
  const totals = CAPTURE_DOMAINS.map((domain) => ({ domain, count: all.filter((proposal) => proposal.domain === domain).length })).filter((item) => item.count > 0);
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLiveRegion="polite">
      <Text style={[theme.typography.title, { color: theme.colors.ink1 }]}>Filed across your life</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {totals.map(({ domain, count }) => <DomainChip key={domain} domain={domain} />)}
      </View>
      <Text style={[theme.typography.display, { color: theme.colors.energy }]}>+{controller.state.xpGained} XP</Text>
      {controller.state.levelledUp ? <Text style={[theme.typography.coach, { color: theme.colors.energy }]}>Level up earned.</Text> : null}
      <Text style={[theme.typography.coach, { color: theme.colors.ink2 }]}>{controller.state.coachLine ?? "Nice capture. Keep only the estimates you trust."}</Text>
      {controller.state.lastCommit ? <ActionButton label="Undo last batch" onPress={() => { void controller.undoLatest(); }} /> : null}
      <ActionButton label="Add more" onPress={() => controller.reset()} tone="strong" />
    </View>
  );
}

function ErrorPane({ controller }: { readonly controller: CaptureController }) {
  const { theme } = useSarthiTheme();
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityLiveRegion="polite">
      <Text style={[theme.typography.body, { color: theme.colors.ink1 }]}>{controller.state.error?.message}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {controller.state.error?.retryable ? <ActionButton label="Retry" onPress={() => { void controller.retry(); }} tone="strong" /> : null}
        <ActionButton label="Copy text" onPress={() => { void controller.copyText(); }} />
        {controller.state.error?.kind === "parse" ? <ActionButton label="Save as note" onPress={() => { void controller.saveAsNote(); }} /> : null}
        <ActionButton label="Back to input" onPress={() => controller.reset(controller.state.rawText)} />
      </View>
    </View>
  );
}

/**
 * Native capture sheet body. Route/tab ownership remains outside this feature; an
 * embedding screen places it in a bottom-sheet host and injects a CaptureRuntime.
 */
export function CaptureSheet({ runtime, initialText = "", prompt, reducedMotion: suppliedReducedMotion, onClose }: CaptureSheetProps) {
  const { theme } = useSarthiTheme();
  const controller = useCaptureController(runtime, initialText);
  const reducedMotion = useReducedMotionPreference(suppliedReducedMotion);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const requestClose = () => {
    if (controller.state.deck.length > 0 && !confirmDismiss) {
      setConfirmDismiss(true);
      return;
    }
    onClose?.();
  };

  const discardAndClose = () => {
    for (const card of controller.state.deck) controller.discard(card.proposal.proposalId);
    onClose?.();
  };

  let body: ReactNode;
  if (controller.state.phase === "input" || controller.state.phase === "recording") body = <InputPane controller={controller} reducedMotion={reducedMotion} />;
  else if (controller.state.phase === "transcribing") body = <ParsingPane text={controller.state.rawText} label="Transcribing your recording…" />;
  else if (controller.state.phase === "transcript-confirm") body = <TranscriptPane controller={controller} />;
  else if (controller.state.phase === "parsing" || controller.state.phase === "filing") body = <ParsingPane text={controller.state.rawText} label={controller.state.phase === "filing" ? "Filing explicit entries…" : "Reading your day…"} />;
  else if (controller.state.phase === "confirm") body = <View style={{ gap: theme.spacing.lg }}><FiledStrip controller={controller} /><Deck controller={controller} /></View>;
  else if (controller.state.phase === "fanout") body = <Fanout controller={controller} />;
  else if (controller.state.phase === "empty") body = <ErrorPane controller={controller} />;
  else body = <ErrorPane controller={controller} />;

  return (
    <View accessible accessibilityLabel="Capture" style={{ backgroundColor: theme.colors.raised, borderColor: theme.colors.line, borderTopLeftRadius: theme.radius.card, borderTopRightRadius: theme.radius.card, borderWidth: theme.border.hairline, maxHeight: "92%", ...theme.shadows.card }}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.card }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[theme.typography.caption, { color: theme.colors.ink3 }]}>CAPTURE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close capture" onPress={requestClose} style={{ minHeight: theme.layout.hitTarget, justifyContent: "center" }}><Text style={[theme.typography.body, { color: theme.colors.ink2 }]}>Close</Text></Pressable>
        </View>
        {prompt ? <Text style={[theme.typography.title, { color: theme.colors.ink1 }]}>{prompt}</Text> : null}
        {confirmDismiss ? <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.input, gap: theme.spacing.xs, padding: theme.spacing.sm }}><Text style={[theme.typography.body, { color: theme.colors.ink1 }]}>{`Discard ${controller.state.deck.length} unreviewed?`}</Text><View style={{ flexDirection: "row", gap: theme.spacing.xs }}><View style={{ flex: 1 }}><ActionButton label="Keep" onPress={() => setConfirmDismiss(false)} /></View><View style={{ flex: 1 }}><ActionButton label="Discard" tone="danger" onPress={discardAndClose} /></View></View></View> : null}
        {body}
      </ScrollView>
    </View>
  );
}

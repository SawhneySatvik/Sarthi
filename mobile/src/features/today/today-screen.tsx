import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, Screen, SarthiButton, SarthiText } from '@mobile/components/primitives';
import { useSarthiTheme } from '@mobile/theme';

export type TodayDomain = 'all' | 'health' | 'money' | 'habits' | 'skills';
export type TodayItem = { id: string; domain: Exclude<TodayDomain, 'all'>; title: string; detail: string; state: 'pending' | 'done' | 'skipped' | 'satisfied'; source?: 'tap' | 'capture' | 'rule'; progressLabel?: string };
export type TodaySnapshot = { dateLabel: string; arcLabel: string; levelLabel: string; streakLabel: string; coachLine: string; items: TodayItem[]; showOnboardingHint?: boolean };
export type TodayScreenProps = { snapshot: TodaySnapshot; initialDomain?: TodayDomain; onDomainChange?: (domain: TodayDomain) => void; onComplete: (item: TodayItem) => void | Promise<void>; onSkip: (item: TodayItem) => void | Promise<void>; onOpenSettings?: () => void; onOpenCoach?: () => void; onOpenStats?: () => void; renderLens?: (domain: Exclude<TodayDomain, 'all'>) => ReactNode };

const domains: TodayDomain[] = ['all', 'health', 'money', 'habits', 'skills'];

export function TodayScreen(props: TodayScreenProps) {
  const { theme } = useSarthiTheme();
  const [domain, setDomain] = useState<TodayDomain>(props.initialDomain ?? 'all');
  const [completedOpen, setCompletedOpen] = useState(false);
  const pending = useMemo(() => props.snapshot.items.filter((item) => item.state === 'pending'), [props.snapshot.items]);
  const completed = useMemo(() => props.snapshot.items.filter((item) => item.state !== 'pending'), [props.snapshot.items]);
  const next = pending[0];
  const styles = makeStyles(theme);

  if (domain !== 'all' && props.renderLens) return <>{props.renderLens(domain)}</>;
  const selectDomain = (entry: TodayDomain) => { setDomain(entry); props.onDomainChange?.(entry); };
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.scene}><View style={styles.header}><View><SarthiText role="display">{props.snapshot.dateLabel}</SarthiText><SarthiText role="caption" tone="muted">{props.snapshot.arcLabel}</SarthiText></View><SarthiButton label="Profile" onPress={props.onOpenSettings} /></View><Pressable accessibilityRole="button" onPress={props.onOpenStats} style={styles.cluster}><SarthiText role="caption">{props.snapshot.streakLabel}</SarthiText><SarthiText role="caption">{props.snapshot.levelLabel}</SarthiText></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{domains.map((entry) => <Pressable key={entry} accessibilityRole="tab" accessibilityState={{ selected: domain === entry }} onPress={() => selectDomain(entry)} style={[styles.chip, { backgroundColor: domain === entry ? theme.colors.raised : theme.colors.card }]}><SarthiText role="caption">{entry === 'all' ? 'All' : entry}</SarthiText></Pressable>)}</ScrollView>
    {props.snapshot.showOnboardingHint && <Card><SarthiText role="caption" tone="muted">Hold the mic and just say your day.</SarthiText></Card>}
    <Pressable accessibilityRole="button" onPress={props.onOpenCoach}><SarthiText role="coach" tone="secondary" numberOfLines={1}>{props.snapshot.coachLine}</SarthiText></Pressable>
    {next ? <><SarthiText role="caption" tone="muted">NEXT UP</SarthiText><Card style={styles.next}><SarthiText role="display">{next.title}</SarthiText><SarthiText role="caption" tone="muted">{next.domain} · {next.detail}</SarthiText>{next.progressLabel && <SarthiText role="caption">{next.progressLabel}</SarthiText>}<View style={styles.actions}><SarthiButton label="Skip" onPress={() => void props.onSkip(next)} /><SarthiButton label="Done" onPress={() => void props.onComplete(next)} /></View></Card></> : <Card><SarthiText role="display">Day complete.</SarthiText><SarthiText role="caption" tone="muted">Your evening recap is ready when you are.</SarthiText></Card>}
    {pending.slice(1).length > 0 && <View style={styles.group}><SarthiText role="caption" tone="muted">LATER TODAY</SarthiText>{pending.slice(1).map((item) => <PlanRow key={item.id} item={item} />)}</View>}
    {completed.length > 0 && <View style={styles.group}><Pressable accessibilityRole="button" onPress={() => setCompletedOpen((open) => !open)} style={styles.completedHeader}><SarthiText role="caption" tone="muted">COMPLETED ({completed.length})</SarthiText><SarthiText role="caption" tone="muted">{completedOpen ? 'Hide' : 'Show'}</SarthiText></Pressable>{completedOpen && completed.map((item) => <PlanRow key={item.id} item={item} />)}</View>}
  </ScrollView></Screen>;
}

function PlanRow({ item }: { item: TodayItem }) { const { theme } = useSarthiTheme(); const styles = makeStyles(theme); return <View style={styles.row}><View style={styles.rowCopy}><SarthiText role="body">{item.title}</SarthiText><SarthiText role="caption" tone="muted">{item.domain} · {item.detail}</SarthiText></View><SarthiText role="caption" tone="muted">{item.state === 'satisfied' ? 'via capture' : item.state}</SarthiText></View>; }
function makeStyles(theme: ReturnType<typeof useSarthiTheme>['theme']) { return { content: { gap: theme.spacing.md, padding: theme.spacing.shell, paddingBottom: theme.spacing.xxl }, scene: { backgroundColor: theme.colors.raised, gap: theme.spacing.md, padding: theme.spacing.card }, header: { alignItems: 'flex-start' as const, flexDirection: 'row' as const, gap: theme.spacing.sm, justifyContent: 'space-between' as const }, cluster: { alignItems: 'center' as const, flexDirection: 'row' as const, gap: theme.spacing.md }, chips: { gap: theme.spacing.xs }, chip: { borderRadius: theme.radius.chip, justifyContent: 'center' as const, minHeight: theme.layout.hitTarget, paddingHorizontal: theme.spacing.md }, next: { gap: theme.spacing.xs }, actions: { flexDirection: 'row' as const, gap: theme.spacing.xs, justifyContent: 'flex-end' as const }, group: { gap: theme.spacing.xs }, completedHeader: { alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'space-between' as const, minHeight: theme.layout.hitTarget }, row: { alignItems: 'center' as const, backgroundColor: theme.colors.raised, borderRadius: theme.radius.input, flexDirection: 'row' as const, gap: theme.spacing.sm, justifyContent: 'space-between' as const, minHeight: theme.layout.hitTarget, padding: theme.spacing.md }, rowCopy: { flex: 1, gap: theme.spacing.xxs } }; }

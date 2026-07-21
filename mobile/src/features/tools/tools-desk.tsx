import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, Screen, SarthiText } from '@mobile/components/primitives';
import { useSarthiTheme } from '@mobile/theme';

export type ToolCard = {
  id: 'focus' | 'meditation' | 'afford-it' | 'workout' | 'suggest';
  title: string;
  description: string;
  status: 'live' | 'soon';
};

export function ToolsDesk({
  tools,
  onOpen,
  renderActive,
}: {
  tools: ToolCard[];
  onOpen: (id: ToolCard['id']) => void;
  renderActive?: ReactNode;
}) {
  const { theme } = useSarthiTheme();
  const styles = {
    content: { gap: theme.spacing.md, padding: theme.spacing.shell, paddingBottom: theme.spacing.xxl },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.xs },
    card: { gap: theme.spacing.xs, minHeight: theme.layout.captureTarget, width: '47%' as const },
  };

  if (renderActive) return <Screen>{renderActive}</Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <SarthiText role="display">Tools</SarthiText>
        <SarthiText role="body" tone="secondary">Tap a tool to start.</SarthiText>
        <View style={styles.grid}>
          {tools.map((tool) => (
            <Pressable
              key={tool.id}
              accessibilityRole="button"
              disabled={tool.status === 'soon'}
              onPress={() => onOpen(tool.id)}>
              <Card style={styles.card}>
                <SarthiText role="title">{tool.title}</SarthiText>
                <SarthiText role="caption" tone="secondary">{tool.description}</SarthiText>
                <SarthiText role="caption" tone={tool.status === 'live' ? 'skills' : 'muted'}>
                  {tool.status === 'live' ? 'Open' : 'On the way'}
                </SarthiText>
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

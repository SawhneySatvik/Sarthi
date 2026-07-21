import { HabitsLens } from './habits-lens';
import { HealthLens } from './health-lens';
import { MoneyLens } from './money-lens';
import { SkillsLens } from './skills-lens';
import type { HabitLensModel, HealthLensModel, MoneyLensModel, SkillLensModel } from './types';

export function LensRenderer(props: { domain: 'health' | 'money' | 'habits' | 'skills'; models: { health: HealthLensModel; money: MoneyLensModel; habits: HabitLensModel; skills: SkillLensModel } }) {
  if (props.domain === 'health') return <HealthLens model={props.models.health} />;
  if (props.domain === 'money') return <MoneyLens model={props.models.money} />;
  if (props.domain === 'habits') return <HabitsLens model={props.models.habits} />;
  return <SkillsLens model={props.models.skills} />;
}

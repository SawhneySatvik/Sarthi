"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus, RotateCw, X } from "lucide-react";

import { cn } from "@/app/lib/utils";
import { DOMAIN_DOT, DOMAIN_LABEL } from "@/components/today/domain";
import { formatPaise } from "@/core/domains/money";
import type { DomainSpine, SpineDomain, SpinePlanItem } from "@/core/onboarding";

/*
 * SpineCard — SAR-012 Pass 2, Phase D (§6). ONE confirm card per selected domain:
 * a domain-hued left edge, a Fraunces header line that visibly derives from the answers
 * (glass-box), and the spine as EDITABLE rows — tap a target to adjust (stepper), swipe a
 * row left (or the × button, the accessible equivalent — DESIGN §142) to drop it, `+ add`
 * at the bottom, and a per-card Regenerate (↻). Tokens only — domain hues + neutral ink;
 * NO amber here (the single earned amber is the stack's `start Day 1` CTA).
 */

const DROP_THRESHOLD = 72;

function stepFor(unit: string | null): number {
  switch (unit) {
    case "paise":
      return 50000; // ₹500
    case "ml":
      return 250;
    case "minutes":
      return 5;
    case "kcal":
      return 50;
    case "grams":
      return 50;
    default:
      return 1;
  }
}

function formatValue(value: number, unit: string | null): string {
  if (unit === "paise") return `${formatPaise(value)} / mo`;
  if (!unit) return `${value}`;
  // Abbreviate the long units so the value stays compact (frees width for the label).
  const short = unit === "minutes" ? "min" : unit === "grams" ? "g" : unit;
  return `${value} ${short}`;
}

interface EditableRow {
  key: string;
  title: string;
  value: number | null;
  unit: string | null;
  /** A skill milestone / label row edits its title but has no numeric target. */
  numeric: boolean;
}

interface EditModel {
  rows: EditableRow[];
  setValue: (key: string, next: number) => void;
  setTitle: (key: string, next: string) => void;
  drop: (key: string) => void;
  add: () => void;
  addLabel: string;
}

/** Rebuild a habits spine's Day-1 items from its (edited) habits, keeping them in sync. */
function habitItems(habits: Extract<DomainSpine, { domain: "habits" }>["habits"]): SpinePlanItem[] {
  return habits.map((habit) => ({
    kind: "task",
    title: habit.name,
    targetValue: habit.targetValue,
    targetUnit: habit.targetUnit,
    linkHabitName: habit.name,
    linkSkillName: null,
  }));
}

function useEditModel(spine: DomainSpine, onChange: (next: DomainSpine) => void): EditModel {
  switch (spine.domain) {
    case "health":
      return {
        addLabel: "Add a target",
        rows: spine.targets.map((target, index) => ({
          key: `t${index}`,
          title: target.title,
          value: target.targetValue,
          unit: target.targetUnit,
          numeric: true,
        })),
        setValue: (key, next) => {
          const i = Number(key.slice(1));
          const targets = spine.targets.map((t, idx) => (idx === i ? { ...t, targetValue: next } : t));
          onChange({ ...spine, targets });
        },
        setTitle: (key, next) => {
          const i = Number(key.slice(1));
          const targets = spine.targets.map((t, idx) => (idx === i ? { ...t, title: next } : t));
          onChange({ ...spine, targets });
        },
        drop: (key) => {
          const i = Number(key.slice(1));
          onChange({ ...spine, targets: spine.targets.filter((_, idx) => idx !== i) });
        },
        add: () =>
          onChange({
            ...spine,
            targets: [...spine.targets, { kind: "checkin", title: "New check-in", targetValue: null, targetUnit: null }],
          }),
      };
    case "habits":
      return {
        addLabel: "Add a habit",
        rows: spine.habits.map((habit, index) => ({
          key: `h${index}`,
          title: habit.name,
          value: habit.targetValue,
          unit: habit.targetUnit,
          numeric: habit.targetValue !== null,
        })),
        setValue: (key, next) => {
          const i = Number(key.slice(1));
          const habits = spine.habits.map((h, idx) => (idx === i ? { ...h, targetValue: next } : h));
          onChange({ ...spine, habits, items: habitItems(habits) });
        },
        setTitle: (key, next) => {
          const i = Number(key.slice(1));
          const habits = spine.habits.map((h, idx) => (idx === i ? { ...h, name: next } : h));
          onChange({ ...spine, habits, items: habitItems(habits) });
        },
        drop: (key) => {
          const i = Number(key.slice(1));
          const habits = spine.habits.filter((_, idx) => idx !== i);
          onChange({ ...spine, habits, items: habitItems(habits) });
        },
        add: () => {
          const habits = [
            ...spine.habits,
            {
              name: "New habit",
              cadence: "daily" as const,
              difficulty: "easy",
              targetValue: null,
              targetUnit: null,
              satisfactionRule: null,
            },
          ];
          onChange({ ...spine, habits, items: habitItems(habits) });
        },
      };
    case "money":
      return {
        addLabel: "Add a category",
        rows: spine.categories.map((category, index) => ({
          key: `c${index}`,
          title: category.name,
          value: category.monthlyLimitPaise,
          unit: "paise",
          numeric: true,
        })),
        setValue: (key, next) => {
          const i = Number(key.slice(1));
          const categories = spine.categories.map((c, idx) =>
            idx === i ? { ...c, monthlyLimitPaise: Math.max(0, next) } : c,
          );
          onChange({ ...spine, categories });
        },
        setTitle: (key, next) => {
          const i = Number(key.slice(1));
          const categories = spine.categories.map((c, idx) => (idx === i ? { ...c, name: next } : c));
          onChange({ ...spine, categories });
        },
        drop: (key) => {
          const i = Number(key.slice(1));
          onChange({ ...spine, categories: spine.categories.filter((_, idx) => idx !== i) });
        },
        add: () =>
          onChange({
            ...spine,
            categories: [...spine.categories, { name: "New category", kind: "expense", monthlyLimitPaise: null }],
          }),
      };
    case "skills":
      return {
        addLabel: "Add a milestone",
        rows: spine.milestones.map((label, index) => ({
          key: `m${index}`,
          title: label,
          value: null,
          unit: null,
          numeric: false,
        })),
        setValue: () => undefined,
        setTitle: (key, next) => {
          const i = Number(key.slice(1));
          onChange({ ...spine, milestones: spine.milestones.map((label, idx) => (idx === i ? next : label)) });
        },
        drop: (key) => {
          const i = Number(key.slice(1));
          onChange({ ...spine, milestones: spine.milestones.filter((_, idx) => idx !== i) });
        },
        add: () => onChange({ ...spine, milestones: [...spine.milestones, "New milestone"] }),
      };
  }
}

function Stepper({ value, unit, onChange }: { value: number; unit: string | null; onChange: (next: number) => void }) {
  const step = stepFor(unit);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(0, value - step))}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
      >
        <Minus size={14} strokeWidth={2} aria-hidden />
      </button>
      <span className="min-w-[3.5rem] text-right font-ui text-body tabular-nums text-ink-1">
        {formatValue(value, unit)}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(value + step)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-line text-ink-2"
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function Row({
  row,
  model,
}: {
  row: EditableRow;
  model: EditModel;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={!reduce}
      drag={reduce ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (info.offset.x < -DROP_THRESHOLD) model.drop(row.key);
      }}
      className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
    >
      <input
        value={row.title}
        onChange={(event) => model.setTitle(row.key, event.target.value)}
        aria-label="Row name"
        className="min-w-0 flex-1 bg-transparent font-ui text-body text-ink-1 focus:outline-none"
      />
      {row.numeric && row.value !== null && (
        <Stepper value={row.value} unit={row.unit} onChange={(next) => model.setValue(row.key, next)} />
      )}
      {row.numeric && row.value === null && (
        <button
          type="button"
          onClick={() => model.setValue(row.key, stepFor(row.unit))}
          className="rounded-chip border border-line px-3 py-1 font-ui text-caption text-ink-2"
        >
          Set a target
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${row.title}`}
        onClick={() => model.drop(row.key)}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-ink-3"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </motion.div>
  );
}

export function SpineCard({
  spine,
  onChange,
  onRegenerate,
}: {
  spine: DomainSpine;
  onChange: (next: DomainSpine) => void;
  onRegenerate: () => void;
}) {
  const model = useEditModel(spine, onChange);
  const domain = spine.domain as SpineDomain;

  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-card">
      {/* Domain-hued left edge (§6). */}
      <span className={cn("absolute inset-y-0 left-0 w-1", DOMAIN_DOT[domain])} aria-hidden />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-ui text-caption uppercase tracking-wide text-ink-2">{DOMAIN_LABEL[domain]}</p>
            {/* Glass-box header — Fraunces, derived from the answers. */}
            <p className="mt-1 font-coach text-body leading-[var(--leading-coach)] text-ink-1">{spine.headerLine}</p>
          </div>
          <button
            type="button"
            aria-label="Regenerate this plan"
            onClick={onRegenerate}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip border border-line text-ink-2"
          >
            <RotateCw size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Skills shows its cumulative practice target above the milestone rows. */}
        {spine.domain === "skills" && spine.skill.targetMinutes !== null && (
          <div className="mt-4 flex items-center justify-between gap-3 border-b border-line pb-3">
            <span className="font-ui text-body text-ink-2">Practice goal</span>
            <Stepper
              value={spine.skill.targetMinutes}
              unit="minutes"
              onChange={(next) => onChange({ ...spine, skill: { ...spine.skill, targetMinutes: Math.max(0, next) } })}
            />
          </div>
        )}

        <div className="mt-2">
          {model.rows.map((row) => (
            <Row key={row.key} row={row} model={model} />
          ))}
        </div>

        <button
          type="button"
          onClick={model.add}
          className="mt-3 flex items-center gap-2 font-ui text-body text-ink-2"
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          {model.addLabel}
        </button>
      </div>
    </section>
  );
}

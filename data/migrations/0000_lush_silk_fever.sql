CREATE TABLE `adaptations` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`planItemId` text NOT NULL,
	`beforeJson` text NOT NULL,
	`afterJson` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`keptAt` text,
	`revertedAt` text
);
--> statement-breakpoint
CREATE INDEX `adaptations_userId_status_createdAt_idx` ON `adaptations` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`provider` text NOT NULL,
	`providerEventId` text NOT NULL,
	`eventType` text NOT NULL,
	`checkoutSessionId` text,
	`paymentId` text,
	`outcome` text NOT NULL,
	`payloadHash` text NOT NULL,
	`processedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_events_provider_providerEventId_uq` ON `billing_events` (`provider`,`providerEventId`);--> statement-breakpoint
CREATE INDEX `billing_events_userId_createdAt_idx` ON `billing_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`categoryId` text NOT NULL,
	`periodStart` text NOT NULL,
	`periodEnd` text NOT NULL,
	`limitPaise` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_userId_categoryId_periodStart_periodEnd_uq` ON `budgets` (`userId`,`categoryId`,`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`provider` text NOT NULL,
	`providerReceiptId` text NOT NULL,
	`amountPaise` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`checkoutUrl` text,
	`expiresAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkout_sessions_userId_providerReceiptId_uq` ON `checkout_sessions` (`userId`,`providerReceiptId`);--> statement-breakpoint
CREATE INDEX `checkout_sessions_userId_status_createdAt_idx` ON `checkout_sessions` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `coach_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`scope` text NOT NULL,
	`localDate` text NOT NULL,
	`text` text NOT NULL,
	`modelProvider` text NOT NULL,
	`modelId` text NOT NULL,
	`evidenceJson` text NOT NULL,
	`stalenessKey` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coach_notes_userId_scope_stalenessKey_uq` ON `coach_notes` (`userId`,`scope`,`stalenessKey`);--> statement-breakpoint
CREATE INDEX `coach_notes_userId_localDate_scope_idx` ON `coach_notes` (`userId`,`localDate`,`scope`);--> statement-breakpoint
CREATE TABLE `commit_plan_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`commitId` text NOT NULL,
	`planItemId` text NOT NULL,
	`statusBefore` text NOT NULL,
	`statusAfter` text NOT NULL,
	`completionSourceBefore` text,
	`completionSourceAfter` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commit_plan_effects_userId_commitId_planItemId_uq` ON `commit_plan_effects` (`userId`,`commitId`,`planItemId`);--> statement-breakpoint
CREATE TABLE `commit_progress_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`commitId` text NOT NULL,
	`domain` text NOT NULL,
	`xpDelta` integer NOT NULL,
	`levelBefore` integer NOT NULL,
	`levelAfter` integer NOT NULL,
	`streakBefore` integer NOT NULL,
	`streakAfter` integer NOT NULL,
	`minutesDelta` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `commit_progress_effects_userId_commitId_idx` ON `commit_progress_effects` (`userId`,`commitId`);--> statement-breakpoint
CREATE TABLE `commit_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`commitId` text NOT NULL,
	`entryKind` text NOT NULL,
	`entryId` text NOT NULL,
	`operation` text NOT NULL,
	`beforeJson` text,
	`afterJson` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commit_rows_userId_commitId_entryKind_entryId_uq` ON `commit_rows` (`userId`,`commitId`,`entryKind`,`entryId`);--> statement-breakpoint
CREATE TABLE `commits` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`draftId` text,
	`idempotencyKey` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`undoExpiresAt` text NOT NULL,
	`undoneAt` text,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commits_userId_idempotencyKey_uq` ON `commits` (`userId`,`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `commits_userId_status_createdAt_idx` ON `commits` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `day_one_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`domain` text NOT NULL,
	`snapshotDate` text NOT NULL,
	`statsJson` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_one_snapshots_userId_domain_uq` ON `day_one_snapshots` (`userId`,`domain`);--> statement-breakpoint
CREATE TABLE `domain_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`domain` text NOT NULL,
	`xp` integer NOT NULL,
	`level` integer NOT NULL,
	`streak` integer NOT NULL,
	`bestStreak` integer NOT NULL,
	`cumulativeMinutes` integer NOT NULL,
	`lastActiveDate` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_progress_userId_domain_uq` ON `domain_progress` (`userId`,`domain`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`domain` text NOT NULL,
	`entryKind` text NOT NULL,
	`entryId` text,
	`storageProvider` text NOT NULL,
	`storagePath` text NOT NULL,
	`mimeType` text NOT NULL,
	`sha256` text NOT NULL,
	`caption` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_userId_sha256_uq` ON `evidence` (`userId`,`sha256`);--> statement-breakpoint
CREATE INDEX `evidence_userId_entryKind_entryId_idx` ON `evidence` (`userId`,`entryKind`,`entryId`);--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`habitId` text NOT NULL,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_userId_habitId_localDate_uq` ON `habit_logs` (`userId`,`habitId`,`localDate`);--> statement-breakpoint
CREATE INDEX `habit_logs_userId_localDate_idx` ON `habit_logs` (`userId`,`localDate`);--> statement-breakpoint
CREATE TABLE `habit_satisfaction_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`habitId` text NOT NULL,
	`sourceDomain` text NOT NULL,
	`sourceKind` text NOT NULL,
	`aggregateField` text NOT NULL,
	`minimumValue` integer NOT NULL,
	`unit` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_satisfaction_rules_userId_habitId_sourceDomain_sourceKind_aggregateField_uq` ON `habit_satisfaction_rules` (`userId`,`habitId`,`sourceDomain`,`sourceKind`,`aggregateField`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`cadence` text NOT NULL,
	`difficulty` text NOT NULL,
	`targetValue` integer,
	`targetUnit` text,
	`isArchived` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habits_userId_name_uq` ON `habits` (`userId`,`name`);--> statement-breakpoint
CREATE TABLE `meal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`mealId` text NOT NULL,
	`name` text NOT NULL,
	`quantityGrams` integer,
	`kcal` integer,
	`proteinGrams` integer,
	`carbsGrams` integer,
	`fatGrams` integer,
	`estimated` integer NOT NULL,
	`confidenceBps` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_items_userId_mealId_idx` ON `meal_items` (`userId`,`mealId`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`kcal` integer,
	`proteinGrams` integer,
	`carbsGrams` integer,
	`fatGrams` integer,
	`source` text NOT NULL,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL,
	`evidenceId` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `meals_userId_localDate_idx` ON `meals` (`userId`,`localDate`);--> statement-breakpoint
CREATE TABLE `money_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`colorKey` text,
	`isSystem` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `money_categories_userId_name_kind_uq` ON `money_categories` (`userId`,`name`,`kind`);--> statement-breakpoint
CREATE TABLE `plan_arcs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`domain` text NOT NULL,
	`mode` text NOT NULL,
	`title` text NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text,
	`dayNumber` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_arcs_userId_domain_status_idx` ON `plan_arcs` (`userId`,`domain`,`status`);--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`arcId` text NOT NULL,
	`domain` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`dueAt` text,
	`localDate` text NOT NULL,
	`targetValue` integer,
	`targetUnit` text,
	`status` text NOT NULL,
	`completionSource` text,
	`ruleJson` text,
	`linkedHabitId` text,
	`linkedSkillId` text
);
--> statement-breakpoint
CREATE INDEX `plan_items_userId_localDate_status_idx` ON `plan_items` (`userId`,`localDate`,`status`);--> statement-breakpoint
CREATE INDEX `plan_items_userId_arcId_status_idx` ON `plan_items` (`userId`,`arcId`,`status`);--> statement-breakpoint
CREATE TABLE `profile_gaps` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`gapKey` text NOT NULL,
	`prompt` text NOT NULL,
	`optionsJson` text,
	`status` text NOT NULL,
	`answeredAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_gaps_userId_gapKey_uq` ON `profile_gaps` (`userId`,`gapKey`);--> statement-breakpoint
CREATE INDEX `profile_gaps_userId_status_idx` ON `profile_gaps` (`userId`,`status`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`userId` text PRIMARY KEY NOT NULL,
	`displayName` text,
	`birthDate` text,
	`heightCm` integer,
	`weightGrams` integer,
	`unitSystem` text NOT NULL,
	`theme` text NOT NULL,
	`themeMode` text NOT NULL,
	`wakeTimeMinutes` integer,
	`sleepTimeMinutes` integer,
	`timeBudgetMinutes` integer,
	`foodPattern` text,
	`screenTimeMinutes` integer,
	`focusPreference` text,
	`careerGoal` text,
	`moneyGoal` text,
	`plan` text NOT NULL,
	`onboardingStatus` text NOT NULL,
	`onboardingStep` integer NOT NULL,
	`seedVersion` integer,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profiles_onboardingStatus_updatedAt_idx` ON `profiles` (`onboardingStatus`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`direction` text NOT NULL,
	`amountPaise` integer NOT NULL,
	`categoryId` text,
	`merchant` text,
	`cadence` text NOT NULL,
	`nextPostDate` text NOT NULL,
	`isPaused` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_rules_userId_nextPostDate_idx` ON `recurring_rules` (`userId`,`nextPostDate`);--> statement-breakpoint
CREATE TABLE `seed_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`seedKey` text NOT NULL,
	`seedVersion` integer NOT NULL,
	`completedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seed_runs_userId_seedKey_uq` ON `seed_runs` (`userId`,`seedKey`);--> statement-breakpoint
CREATE TABLE `skill_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`skillId` text NOT NULL,
	`label` text NOT NULL,
	`sortOrder` integer NOT NULL,
	`completedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_milestones_userId_skillId_sortOrder_uq` ON `skill_milestones` (`userId`,`skillId`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `skill_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`skillId` text NOT NULL,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`minutes` integer NOT NULL,
	`source` text NOT NULL,
	`note` text,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skill_sessions_userId_skillId_localDate_idx` ON `skill_sessions` (`userId`,`skillId`,`localDate`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`targetMinutes` integer,
	`isArchived` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_userId_name_uq` ON `skills` (`userId`,`name`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`direction` text NOT NULL,
	`amountPaise` integer NOT NULL,
	`categoryId` text,
	`merchant` text,
	`note` text,
	`source` text NOT NULL,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL,
	`evidenceId` text,
	`recurringRuleId` text
);
--> statement-breakpoint
CREATE INDEX `transactions_userId_localDate_idx` ON `transactions` (`userId`,`localDate`);--> statement-breakpoint
CREATE INDEX `transactions_userId_categoryId_localDate_idx` ON `transactions` (`userId`,`categoryId`,`localDate`);--> statement-breakpoint
CREATE INDEX `transactions_userId_recurringRuleId_idx` ON `transactions` (`userId`,`recurringRuleId`);--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`millilitres` integer NOT NULL,
	`source` text NOT NULL,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_logs_userId_localDate_idx` ON `water_logs` (`userId`,`localDate`);--> statement-breakpoint
CREATE TABLE `weigh_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`weightGrams` integer NOT NULL,
	`source` text NOT NULL,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weigh_ins_userId_localDate_idx` ON `weigh_ins` (`userId`,`localDate`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`workoutId` text NOT NULL,
	`name` text NOT NULL,
	`sets` integer,
	`reps` integer,
	`loadGrams` integer,
	`sortOrder` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_userId_workoutId_sortOrder_idx` ON `workout_exercises` (`userId`,`workoutId`,`sortOrder`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`occurredAt` text NOT NULL,
	`localDate` text NOT NULL,
	`timezone` text NOT NULL,
	`durationMinutes` integer,
	`burnKcal` integer,
	`source` text NOT NULL,
	`confidenceBps` integer NOT NULL,
	`estimated` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `workouts_userId_localDate_idx` ON `workouts` (`userId`,`localDate`);
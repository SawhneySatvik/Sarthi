CREATE TABLE `daily_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`localDate` text NOT NULL,
	`mood` text NOT NULL CHECK(`mood` IN ('rough','low','steady','good','great')),
	`energyLevel` integer NOT NULL,
	`sleepMinutes` integer,
	`journal` text NOT NULL,
	`summary` text NOT NULL,
	`summaryProvider` text NOT NULL,
	`summaryModelId` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reflections_userId_localDate_uq` ON `daily_reflections` (`userId`,`localDate`);--> statement-breakpoint
CREATE INDEX `daily_reflections_userId_localDate_idx` ON `daily_reflections` (`userId`,`localDate`);--> statement-breakpoint
CREATE TABLE `reflection_media` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deletedAt` text,
	`reflectionId` text NOT NULL,
	`storageProvider` text NOT NULL,
	`storagePath` text NOT NULL,
	`mimeType` text NOT NULL,
	`byteSize` integer NOT NULL,
	`sha256` text NOT NULL,
	`caption` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflection_media_userId_sha256_uq` ON `reflection_media` (`userId`,`sha256`);--> statement-breakpoint
CREATE INDEX `reflection_media_userId_reflectionId_idx` ON `reflection_media` (`userId`,`reflectionId`);

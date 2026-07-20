CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`createdAt` text NOT NULL,
	`email` text NOT NULL,
	`source` text DEFAULT 'pricing' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_uq` ON `waitlist` (`email`);

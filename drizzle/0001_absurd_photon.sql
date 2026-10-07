CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`character_name` text,
	`photo_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_token_idx` ON `profiles` (`token`);--> statement-breakpoint
CREATE INDEX `profiles_campaign_idx` ON `profiles` (`campaign_id`);
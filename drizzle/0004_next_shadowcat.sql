-- Wipe pre-auth data: campaigns cascade to channels, invites, profiles, messages.
DELETE FROM `campaigns`;--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `owner_id` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `invites` ADD `created_by` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `user_id` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `role` text DEFAULT 'guest' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `invite_token` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `banned_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `banned_by` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `ban_reason` text;--> statement-breakpoint
CREATE INDEX `profiles_user_idx` ON `profiles` (`user_id`);
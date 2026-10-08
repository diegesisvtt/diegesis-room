CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`share_quality` text DEFAULT '1080' NOT NULL,
	`camera_quality` text DEFAULT '720' NOT NULL,
	`echo_cancellation` integer DEFAULT true NOT NULL,
	`noise_suppression` integer DEFAULT true NOT NULL,
	`auto_gain_control` integer DEFAULT true NOT NULL,
	`visual_effects` integer DEFAULT true NOT NULL,
	`stereo` integer DEFAULT false NOT NULL,
	`content_hint` text DEFAULT 'detail' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

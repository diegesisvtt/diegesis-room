ALTER TABLE `user_preferences` ADD `microphone_device_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `camera_device_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `speaker_device_id` text DEFAULT 'default' NOT NULL;
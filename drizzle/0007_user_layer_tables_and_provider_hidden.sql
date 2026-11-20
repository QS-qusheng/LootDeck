ALTER TABLE `providers` ADD COLUMN `hidden` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pump_servers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sub` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT '[]' NOT NULL,
	`freq` text DEFAULT 'hot' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`desc` text DEFAULT '' NOT NULL,
	`zone` text DEFAULT 'general' NOT NULL,
	`tab` text DEFAULT 'A' NOT NULL,
	`sub` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'none' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_path` text DEFAULT '' NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`last_used` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`zone` text DEFAULT 'general' NOT NULL,
	`tab` text DEFAULT 'A' NOT NULL,
	`title` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`applies_to` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`last_called_at` integer,
	`created_at` integer NOT NULL
);

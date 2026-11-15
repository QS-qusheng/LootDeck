CREATE TABLE `gateway_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_name` text NOT NULL,
	`calls_7d` integer NOT NULL DEFAULT 0,
	`tokens_7d` integer NOT NULL DEFAULT 0,
	`last_call_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gateway_stats_provider_name_unique` ON `gateway_stats` (`provider_name`);

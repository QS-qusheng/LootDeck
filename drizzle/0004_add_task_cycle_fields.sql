ALTER TABLE `providers` ADD COLUMN `task_cycle` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `providers` ADD COLUMN `task_last_done_at` integer;

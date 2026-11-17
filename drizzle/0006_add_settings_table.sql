CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `providers` ADD COLUMN `owned` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`) SELECT 'board_mode', CASE WHEN EXISTS (SELECT 1 FROM `providers`) THEN 'own' ELSE 'example' END;

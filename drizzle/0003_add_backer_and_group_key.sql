ALTER TABLE providers ADD COLUMN backer TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE providers ADD COLUMN group_key TEXT NOT NULL DEFAULT 'other';
--> statement-breakpoint
ALTER TABLE providers ADD COLUMN sort_value REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE providers ADD COLUMN featured_rank INTEGER NOT NULL DEFAULT 0;

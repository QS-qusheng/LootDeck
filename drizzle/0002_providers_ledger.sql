DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  quota_text TEXT NOT NULL DEFAULT '',
  daily_detail TEXT NOT NULL DEFAULT '',
  refresh_rule TEXT NOT NULL DEFAULT '',
  rate_limit TEXT NOT NULL DEFAULT '',
  models TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  condition_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unclaimed',
  key_tail TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

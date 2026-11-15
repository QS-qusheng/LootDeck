import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const providerStatus = [
  "unclaimed",
  "check_old",
  "claimed",
  "pooled",
  "registered",
] as const;
export type ProviderStatus = (typeof providerStatus)[number];

export const taskCycle = ["none", "daily", "weekly", "monthly"] as const;
export type TaskCycle = (typeof taskCycle)[number];

// 网关（new-api）真实调用统计：按渠道（提供方名）一行，存近 7 天调用次数、
// 近 7 天消耗 token 数、最近一次调用时间。由每日任务聚合网关日志后经
// syncGatewayStats 动作写入；未接网关的渠道没有行，统计为空。
export const gatewayStats = sqliteTable("gateway_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerName: text("provider_name").notNull(),
  calls7d: integer("calls_7d").notNull().default(0),
  tokens7d: integer("tokens_7d").notNull().default(0),
  lastCallAt: integer("last_call_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  quotaText: text("quota_text").notNull().default(""),
  dailyDetail: text("daily_detail").notNull().default(""),
  refreshRule: text("refresh_rule").notNull().default(""),
  rateLimit: text("rate_limit").notNull().default(""),
  models: text("models").notNull().default(""),
  baseUrl: text("base_url").notNull().default(""),
  conditionText: text("condition_text").notNull().default(""),
  backer: text("backer").notNull().default(""),
  groupKey: text("group_key").notNull().default("other"),
  sortValue: real("sort_value").notNull().default(0),
  featuredRank: integer("featured_rank").notNull().default(0),
  status: text("status", { enum: providerStatus }).notNull().default("unclaimed"),
  taskCycle: text("task_cycle", { enum: taskCycle }).notNull().default("none"),
  taskLastDoneAt: integer("task_last_done_at", { mode: "timestamp_ms" }),
  keyTail: text("key_tail").notNull().default(""),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

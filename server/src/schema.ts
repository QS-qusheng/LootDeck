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
  // owned=1：这一行是看板主人自己的战利品（自己新增的、或在示例状态下亲手
  // 动过的）。示例状态翻转清场时只有 owned 行原样保留，其余示例数据复位。
  owned: integer("owned").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 键值设置。当前只用 board_mode 一条：example＝示例状态（用户还没添置任何
// 自己的战利品，甲板展示内置示例数据并明确标注示例）；own＝用户自己的
// 状态（只显示他自己的数据）。迁移 0006 按存量数据定初始值：台账已有数据
// （如原作者本人）直接 own，全新安装从 example 起步；用户添置第一件自己的
// 战利品时由动作层自动翻转 example → own 并清场，此后不再回示例。
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

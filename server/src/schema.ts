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
  // hidden=1：用户在展示层隐藏了这张卡（出厂卡只藏不删，规格 §7 口径）；
  // 隐藏只影响呈现与计数，台账行本身不动，设置里可恢复。
  hidden: integer("hidden").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 键值设置。当前只用 board_mode 一条：example＝示例状态（用户还没添置任何
// 自己的战利品，甲板展示内置示例数据并明确标注示例）；own＝用户自己的
// 状态（只显示他自己的数据）。迁移 0006 按存量数据定初始值：台账已有数据
// （如已有自己数据的实例）直接 own，全新安装从 example 起步；用户添置第一件自己的
// 战利品时由动作层自动翻转 example → own 并清场，此后不再回示例。
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

// ── 用户数据层（规格 §7 双层模型）：出厂种子（服务端 CATALOG、客户端技能
// 目录与工作流注册表）只读不改，用户新增/修改只写下面三张表，页面读取
// 时两层合并现算。 ──────────────────────────────────────────────────

// 补给泵图服务器清单（规格 §4.3 P0：服务器清单改数据层，不再以代码常量
// 下发）。tags / status 存 JSON 文本（status 为 {text, tone} 数组）。
// freq：hot=常用资源页 / cold=不常用资源页（泵图分页用）。
// demo=1：出厂虚构示例组（用户编辑/新增后转 0）；own 态台账为空时
// getPumpServers 回落这组并挂示例标。
export const pumpServers = sqliteTable("pump_servers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sub: text("sub").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  status: text("status").notNull().default("[]"),
  freq: text("freq", { enum: ["hot", "cold"] }).notNull().default("hot"),
  demo: integer("demo").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 用户自加 Skill（规格 §7.2）：与出厂目录同构（名称/简介/归属/来源），
// zone=general 时 tab 为栏键 A–E/L0，zone=exclusive 时 tab 为组键
// company/personal。来源字段按 §5.3 结构：type + url + path。
export const userSkills = sqliteTable("user_skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  desc: text("desc").notNull().default(""),
  zone: text("zone", { enum: ["general", "exclusive"] })
    .notNull()
    .default("general"),
  tab: text("tab").notNull().default("A"),
  sub: text("sub").notNull().default(""),
  sourceType: text("source_type", {
    enum: ["github", "url", "bundled", "none"],
  })
    .notNull()
    .default("none"),
  sourceUrl: text("source_url").notNull().default(""),
  sourcePath: text("source_path").notNull().default(""),
  calls: integer("calls").notNull().default(0),
  lastUsed: integer("last_used", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 用户自建工作流（规格 §7.3）：id 为系统生成的稳定 ID（wf-user-<slug>），
// steps 存 JSON 文本（[{skill, branches[]}]，步序即流程顺序）；
// calls/lastCalledAt 与出厂注册表同字段、同排序口径（§5.5）。
export const userWorkflows = sqliteTable("user_workflows", {
  id: text("id").primaryKey(),
  zone: text("zone", { enum: ["general", "exclusive"] })
    .notNull()
    .default("general"),
  tab: text("tab").notNull().default("A"),
  title: text("title").notNull(),
  purpose: text("purpose").notNull().default(""),
  appliesTo: text("applies_to").notNull().default(""),
  steps: text("steps").notNull().default("[]"),
  calls: integer("calls").notNull().default(0),
  lastCalledAt: integer("last_called_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

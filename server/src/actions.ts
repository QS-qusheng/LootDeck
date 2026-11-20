import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";

const statusEnum = z.enum([
  "unclaimed",
  "check_old",
  "claimed",
  "pooled",
  "registered",
]);

const taskCycleEnum = z.enum(["none", "daily", "weekly", "monthly"]);

const providerShape = z.object({
  id: z.number(),
  name: z.string(),
  nameEn: z.string(),
  quotaText: z.string(),
  dailyDetail: z.string(),
  refreshRule: z.string(),
  rateLimit: z.string(),
  models: z.string(),
  baseUrl: z.string(),
  conditionText: z.string(),
  backer: z.string(),
  groupKey: z.string(),
  sortValue: z.number(),
  featuredRank: z.number(),
  builtin: z.boolean(),
  // 展示层隐藏（出厂卡只藏不删）：true 时页面不呈现、不计数，设置里可恢复
  hidden: z.boolean(),
  // 示例专属条目（作者本人的服务器卡）：只在示例状态下入账展示；用户
  // 翻转到自己的状态时删除，自己的看板里永不混入
  demoOnly: z.boolean(),
  status: statusEnum,
  taskCycle: taskCycleEnum,
  taskLastDoneAt: z.number().nullable(),
  keyTail: z.string(),
  note: z.string(),
  sortOrder: z.number(),
  // 网关真实调用统计（gateway_stats 按名关联）：未接网关或尚无统计时全为 null
  gwCalls7d: z.number().nullable(),
  gwTokens7d: z.number().nullable(),
  gwLastCallAt: z.number().nullable(),
});

type ProviderRow = typeof schema.providers.$inferSelect;
type GatewayStatRow = typeof schema.gatewayStats.$inferSelect;

function toProvider(
  row: ProviderRow,
  stat?: GatewayStatRow,
): z.infer<typeof providerShape> {
  return {
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    quotaText: row.quotaText,
    dailyDetail: row.dailyDetail,
    refreshRule: row.refreshRule,
    rateLimit: row.rateLimit,
    models: row.models,
    baseUrl: row.baseUrl,
    conditionText: row.conditionText,
    backer: row.backer,
    groupKey: row.groupKey,
    sortValue: row.sortValue,
    featuredRank: row.featuredRank,
    builtin: CATALOG_NAMES.has(row.name),
    hidden: row.hidden === 1,
    demoOnly: DEMO_ONLY_NAMES.has(row.name),
    status: row.status,
    taskCycle: row.taskCycle,
    taskLastDoneAt: row.taskLastDoneAt ? row.taskLastDoneAt.getTime() : null,
    keyTail: row.keyTail,
    note: row.note,
    sortOrder: row.sortOrder,
    gwCalls7d: stat ? stat.calls7d : null,
    gwTokens7d: stat ? stat.tokens7d : null,
    gwLastCallAt: stat?.lastCallAt ? stat.lastCallAt.getTime() : null,
  };
}

// ── 全量目录（来源：AIHOT 免费 Token 页 aihot.news/free-tokens 卡片中可入池者，数据经核实后录入；只收能编程调用的模型 API、免费算力与底层提效工具，产品内积分不收，见 REMOVED_NAMES；现共 25 家）
// group: api=免费Token（API可调度） / tool=工具福利 / compute=免费算力 / efficiency=提效工具
// sortValue: 基础量（每日刷新型=日量、其余=面值/总量）；入库时经 effectiveValue 换算成
//   「实际可用价值」再存：每日 ×30（30 天累计）、每周 ×30/7、代金券 ×0.5（有门槛和范围限制）、
//   免费不限量类按附带赠金面值并 +0.5 同值优先（排在代金券前面）。卡墙按存入值类内降序。
// featuredRank: 左列「大羊毛推荐」名次（0=不上推荐列）
// litStatus: 已点亮的初始状态（仅在现状态为未点亮时应用，不覆盖用户改过的状态）
type CatalogEntry = {
  name: string;
  nameEn: string;
  backer: string;
  quota: string;
  content: string;
  cycle: string;
  group: "api" | "tool" | "compute" | "efficiency";
  sortValue: number;
  // 价值口径：daily=每日刷新（×30）/ weekly=每周刷新（×30/7）/ voucher=代金券（×0.5）/
  // free=免费不限量（按附带赠金算，同值优先于代金券）；缺省=一次性面值
  valueKind?: "daily" | "weekly" | "voucher" | "free";
  featuredRank?: number;
  litStatus?: "pooled" | "registered";
  note?: string;
  // 示例专属：作者本人的服务器卡，只在示例状态入账；用户自己的状态里不出现
  demoOnly?: boolean;
  // 用户自己的状态下用的公开版文案（目录原文含作者本人的持有状态口径，
  // 如「已在手」「已接管」；新用户还没领，详情里要换成中性说法）
  publicQuota?: string;
  publicContent?: string;
  // 定期任务：周期 + 种子上次完成日（YYYY-MM-DD）；仅在台账从未配置过时应用一次
  taskCycle?: "daily" | "weekly" | "monthly";
  taskSeedDoneDay?: string;
};

// 实际可用价值换算（卡墙排序口径，用户 2026-11-15 拍板）
function effectiveValue(e: CatalogEntry): number {
  switch (e.valueKind) {
    case "daily":
      return e.sortValue * 30;
    case "weekly":
      return (e.sortValue * 30) / 7;
    case "voucher":
      return e.sortValue * 0.5;
    case "free":
      return e.sortValue + 0.5;
    default:
      return e.sortValue;
  }
}

const CATALOG: CatalogEntry[] = [
  // ── 提效工具（装好的插件与 Skill，也是羊毛） ──────────────────
  { name: "agent-browser", nameEn: "agent-browser", backer: "开源工具", quota: "替你批量点网页、填表", content: "替你打开网页、点按钮、填表和抓内容，批量网页活交给它。已装好，可随时用；连接中断会自动重启，不用手动处理。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 500 },
  { name: "agent-desktop", nameEn: "agent-desktop", backer: "开源工具", quota: "替你操作电脑里的软件", content: "替你在 Windows 和 Mac 两台电脑上点软件按钮、切窗口、看截图。重点是能操作那些不能靠输指令控制的软件；双机都已装好、实测通过。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 400 },
  { name: "Agent Reach", nameEn: "Agent Reach", backer: "开源工具", quota: "免登录搜网页、看视频内容", content: "免登录搜读 GitHub、YouTube、B 站、V2EX 和普通网页，找资料、看视频内容更省事。这五个渠道都实测拿到了内容，已装好，可随时用。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 300 },
  { name: "Scrapling", nameEn: "Scrapling", backer: "开源工具", quota: "专啃难抓的网页：指纹抓取、改版自适应", content: "开源网页抓取工具：带浏览器指纹伪装抓页面，网站改版后能靠元素指纹自己重新定位、不用重写抓法。已装好并实测通过；需要真浏览器渲染的页面用 agent-browser。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 250 },
  { name: "new-api", nameEn: "new-api", backer: "开源项目（AGPL）", quota: "各家模型统一入口、记用量", content: "把各家模型接到一个入口，按优先级调用，失败自动换一家，并记录各家用量。已装好；只需加上“快过期先用”的规则，以后补给泵图再接真实用量。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 200 },
  { name: "Codex", nameEn: "Codex", backer: "OpenAI（Pro 账号）", quota: "替你写代码、改项目", content: "在本机替你写代码、改项目、检查能否打包运行。已装好，用 Pro 账号；你的 Muse 定要求、验结果，它负责写。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 150 },
  { name: "MarkItDown", nameEn: "MarkItDown", backer: "微软（开源）", quota: "把 PDF、Word、PPT 转成干净文本喂给 AI", content: "微软开源的文件转换工具，PDF、Word、PPT、Excel 都能一键转成干净的 Markdown 文本，AI 直接就能读。本机已装好并实测转换成功，带 MCP 接口，随叫随用。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 140 },
  { name: "共享记忆库", nameEn: "mcp-memory-service", backer: "开源项目", quota: "给所有 AI 装的共同记忆，学到的事互通", content: "开源的共享记忆服务，装在本机、数据不出门。多个 AI 共用一个记忆库，一个学到的事，其他的也能查到。已装好，存入和按意思查找都实测通过。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 130 },
  { name: "本地语音", nameEn: "FunASR + Kokoro", backer: "开源工具", quota: "免费的耳朵和嘴：听写和朗读都在本机", content: "本地语音两件套：FunASR 把语音转成文字，Kokoro 把文字读出声，都在本机跑、不花钱不限量。合成→识别闭环已实测逐字对上。Kokoro 是预置女声，当随身嘴用。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 120 },
  // ── 免费Token（API可调度） ──────────────────────────────────────────────
  { name: "火山方舟", nameEn: "Volcano Ark", backer: "字节跳动", quota: "试用各家模型，不用领", content: "可分别试用平台上的模型，比较哪种适合你的活。每个模型一次性有 50 万 Token（按处理文字量计的额度），不用领，已经到手。", cycle: "一次性", group: "api", sortValue: 500000, featuredRank: 2 },
  { name: "Cloudflare Workers AI", nameEn: "Cloudflare Workers AI", backer: "Cloudflare（美国）", quota: "每天免费用模型处理任务", content: "可每天免费调用模型处理任务。每天给 10,000 Neurons（用量单位），约够小模型几百次、70B 级大模型 100 次；UTC 00:00 刷新，不累积。", cycle: "每日（00:00 UTC 刷新，不滚存）", group: "api", sortValue: 10000, valueKind: "daily", featuredRank: 3 },
  { name: "魔搭社区", nameEn: "ModelScope", backer: "阿里巴巴 / 阿里云", quota: "每天领点数，用来调用模型", content: "可每天领点数来调用模型。每天共 250 魔粒（调用点数）：登录领 200，绑定阿里云再得 50；每次约扣 0.5／1／2 魔粒，当天过期，不累积。", cycle: "每日（当天过期，不攒）", group: "api", sortValue: 250, valueKind: "daily", featuredRank: 4 },
  { name: "OpenRouter", nameEn: "OpenRouter", backer: "OpenRouter（美国）", quota: "每天免费调用模型", content: "可调用标着 :free 的免费模型来处理任务。每天 50 次，每分钟 20 次；一次性买过至少 $10 额度后，升到每天 1,000 次。", cycle: "每日", group: "api", sortValue: 50, valueKind: "daily", featuredRank: 5 },
  { name: "百度智能云", nameEn: "", backer: "百度", quota: "用券抵百度智能云费用", content: "可用代金券抵用百度智能云费用，具体适用范围原文没写。一次性给 ¥20 代金券。", cycle: "一次性", group: "api", sortValue: 20, valueKind: "voucher", featuredRank: 8 },
  { name: "硅基流动", nameEn: "SiliconFlow", backer: "硅基流动（国产独立厂商）", quota: "免费用小模型，新人另有赠金", content: "可长期免费调用部分小模型，但调用速度有限制。国内站新用户另有 ¥16 赠金；免费模型每次调用为 ¥0。", cycle: "长期免费档", group: "api", sortValue: 16, valueKind: "free", featuredRank: 6 },
  { name: "硅基流动新人赠金", nameEn: "", backer: "硅基流动", quota: "用新人赠金试模型", content: "可用新人赠金试用模型，国内站新用户一次性获赠 ¥16。这张卡已入池，与已点亮的“硅基流动”是同一家、不同卡，原文未说明赠金能否重复领取。", cycle: "一次性", group: "api", sortValue: 16 },
  { name: "DeepSeek", nameEn: "DeepSeek", backer: "深度求索", quota: "用赠金试用模型", content: "可用赠金试用 DeepSeek 模型。一次性赠金 ¥6。", cycle: "一次性", group: "api", sortValue: 6, featuredRank: 7 },
  { name: "Groq", nameEn: "Groq", backer: "Groq（美国）", quota: "长期免费层，每天 1000 次请求起，免绑卡", content: "可长期免费调用 Groq 上的开源模型处理任务。每天 1000 次请求起，免绑卡；注册后拿 key 即可调用。", cycle: "长期免费层", group: "api", sortValue: 1000, valueKind: "daily" },
  { name: "Google Gemini API", nameEn: "Google Gemini API", backer: "Google", quota: "Gemini Flash 免费层，Google 号直接调", content: "可用现成的 Google 账号直接调用 Gemini Flash 模型处理任务，走免费层，不用另外注册。", cycle: "长期免费层", group: "api", sortValue: 1 },
  // ── 工具福利 ────────────────────────────────────────────────
  // ── 免费算力 ────────────────────────────────────────────────
  { name: "Kaggle", nameEn: "Kaggle", backer: "Google", quota: "借云端显卡批量跑计算", content: "可在云端运行代码，借显卡批量跑计算。每周约 30 小时，配两块 Tesla T4 显卡，周六刷新；会话制，闲置会断、文件不保存。", cycle: "每周（周六刷新）", group: "compute", sortValue: 30, valueKind: "weekly", featuredRank: 1 },
  { name: "GitHub Codespaces", nameEn: "GitHub Codespaces", backer: "GitHub", quota: "每月 60 小时开发机", content: "GitHub 账号自带的云端开发机，每月 120 核时（2 核机约 60 小时），每月刷新。会话制：闲置约 30 分钟自动停，文件保留。", cycle: "每月刷新", group: "compute", sortValue: 90 },
  { name: "Google Cloud", nameEn: "Google Cloud", backer: "Google", quota: "试用云服务器 + 永久免费小机", content: "新账号可领 $300 试用赠金（有到期日），另有一台 e2-micro 永久免费小机器可以长期挂服务。", cycle: "一次性（赠金有到期日）+ e2-micro 永久免费", group: "compute", sortValue: 300 },
  { name: "AWS", nameEn: "Amazon Web Services", backer: "亚马逊 AWS", quota: "免费计划开云服务器", content: "新版免费计划：注册先到 $100，再在控制台完成 6 个新手任务（每个 $20）共 $200；免费计划 6 个月。开服务器选免费计划支持的机型（如 t4g.small，约 $12/月），不要点付费升级。", cycle: "免费计划 6 个月（期后需绑卡续用）", group: "compute", sortValue: 200 },
  { name: "示例云电脑", nameEn: "Example Cloud PC", backer: "示例", quota: "示例数据：一台云电脑", content: "这是一张示例专属卡，只在示例状态下出现，用来演示示例数据与你自己的数据如何区分：当你添置第一件自己的战利品、看板翻转到你自己的状态时，它会随示例清场一起消失，不会混进你的看板。", cycle: "长期", group: "compute", sortValue: 110, demoOnly: true },
  { name: "示例海外服务器", nameEn: "Example VPS", backer: "示例", quota: "示例数据：一台海外小服务器", content: "这是一张示例专属卡，只在示例状态下出现，用来演示示例数据与你自己的数据如何区分：当你添置第一件自己的战利品、看板翻转到你自己的状态时，它会随示例清场一起消失，不会混进你的看板。", cycle: "长期", group: "compute", sortValue: 105, demoOnly: true },
];

// ── 补给泵图服务器层（数据层，规格 §4.3 P0） ──────────────────────
// 服务器清单存 pump_servers 表（用户数据层，可增删改），不再以代码
// 常量下发。下面两组只是「表为空时的首次播种」：own 与 example 两态都播同一组虚构示例
// 服务器（开源版不带任何真实服务器清单；你在管理面板里加的服务器
// （demo=1）。播种后页面只读表，用户改动只写表、种子常量不再参与。
// freq 分页口径（台账驻留与实际调用实情，不编数字）：有 agent 驻留或
// 生产服务常驻的＝hot（常用页）；会话制/按需开机（Kaggle 会话制 GPU、
// Codespaces 闲置自动停）＝cold（不常用页）。
const pumpStatusShape = z.object({
  text: z.string(),
  tone: z.enum(["ok", "due", "warn", "muted"]),
});
const pumpServerShape = z.object({
  name: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  status: z.array(pumpStatusShape),
  freq: z.enum(["hot", "cold"]),
});
type PumpServerSeed = z.infer<typeof pumpServerShape>;

// 下发给客户端的行形状（带 id 与 demo 标，供页面编辑与示例识别）
const pumpServerRowShape = pumpServerShape.extend({
  id: z.number(),
  demo: z.boolean(),
});
type PumpServerRow = z.infer<typeof pumpServerRowShape>;

const PUMP_SERVERS: PumpServerSeed[] = [
  {
    name: "腾讯云 · 云服务器",
    sub: "云服务器",
    tags: ["业务站点", "数据处理"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
    freq: "hot",
  },
  {
    name: "香港 · 云服务器",
    sub: "云服务器",
    tags: ["应用服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
    freq: "hot",
  },
  {
    name: "Kaggle · 免费 GPU",
    sub: "每周约 30 小时 T4 x2",
    tags: ["GPU 跑批"],
    status: [
      { text: "可用", tone: "ok" },
      { text: "每周六刷新额度", tone: "due" },
      { text: "会话制 · 闲置会断", tone: "warn" },
    ],
    freq: "cold",
  },
  {
    name: "GitHub Codespaces",
    sub: "开发机 · 每月 60 小时",
    tags: ["云端开发"],
    status: [
      { text: "可用", tone: "ok" },
      { text: "每月刷新", tone: "due" },
      { text: "闲置约 30 分钟自动停", tone: "warn" },
    ],
    freq: "cold",
  },
  {
    name: "云电脑（示例）",
    sub: "免费云电脑 · 示例",
    tags: ["远程桌面"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "限时免费 · 无固定到期日", tone: "due" },
      { text: "闲置可能被平台回收", tone: "warn" },
    ],
    freq: "hot",
  },
  {
    name: "海外云服务器（示例）",
    sub: "海外小服务器 · 示例",
    tags: ["网络出口"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "试用赠金期内", tone: "due" },
      { text: "临时 IP · 重启可能变", tone: "warn" },
    ],
    freq: "hot",
  },
  {
    name: "云服务器（示例）",
    sub: "免费计划小服务器 · 示例",
    tags: ["常驻服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "固定 IP", tone: "muted" },
      { text: "免费计划期内", tone: "due" },
      { text: "期后需绑卡续用", tone: "warn" },
    ],
    freq: "hot",
  },
];

// 出厂虚构示例组（example 态播种用，demo=1）：名称与说明均为虚构，
// 与作者真实服务器零重合（规格 §4.3）。freq 口径同上：常驻服务 hot、
// 会话制/按需开机（Kaggle、Codespaces）cold。
const EXAMPLE_SERVERS: PumpServerSeed[] = [
  {
    name: "腾讯云 · 云服务器",
    sub: "云服务器",
    tags: ["业务站点", "数据处理"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
    freq: "hot",
  },
  {
    name: "香港 · 云服务器",
    sub: "云服务器",
    tags: ["应用服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
    freq: "hot",
  },
  {
    name: "Kaggle · 免费 GPU",
    sub: "每周约 30 小时 T4 x2",
    tags: ["GPU 跑批"],
    status: [
      { text: "可用", tone: "ok" },
      { text: "每周六刷新额度", tone: "due" },
      { text: "会话制 · 闲置会断", tone: "warn" },
    ],
    freq: "cold",
  },
  {
    name: "GitHub Codespaces",
    sub: "开发机 · 每月 60 小时",
    tags: ["云端开发"],
    status: [
      { text: "可用", tone: "ok" },
      { text: "每月刷新", tone: "due" },
      { text: "闲置约 30 分钟自动停", tone: "warn" },
    ],
    freq: "cold",
  },
  {
    name: "云电脑（示例）",
    sub: "免费云电脑 · 示例",
    tags: ["远程桌面"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "限时免费 · 无固定到期日", tone: "due" },
      { text: "闲置可能被平台回收", tone: "warn" },
    ],
    freq: "hot",
  },
  {
    name: "海外云服务器（示例）",
    sub: "海外小服务器 · 示例",
    tags: ["网络出口"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "试用赠金期内", tone: "due" },
      { text: "临时 IP · 重启可能变", tone: "warn" },
    ],
    freq: "hot",
  },
  {
    name: "云服务器（示例）",
    sub: "免费计划小服务器 · 示例",
    tags: ["常驻服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "固定 IP", tone: "muted" },
      { text: "免费计划期内", tone: "due" },
      { text: "期后需绑卡续用", tone: "warn" },
    ],
    freq: "hot",
  },
];

type PumpServerDbRow = typeof schema.pumpServers.$inferSelect;

function parseJsonArray<T>(text: string, fallback: T[]): T[] {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function toPumpServerRow(row: PumpServerDbRow): PumpServerRow {
  return {
    id: row.id,
    name: row.name,
    sub: row.sub,
    tags: parseJsonArray<string>(row.tags, []),
    status: parseJsonArray<{ text: string; tone: "ok" | "due" | "warn" | "muted" }>(
      row.status,
      [],
    ),
    freq: row.freq,
    demo: row.demo === 1,
  };
}

// 读服务器清单（用户数据层）：表为空时按看板状态播种一次——own 播作者
// 本人的 7 台（旧代码常量迁入台账），example 播虚构示例组（demo=1）。
// 此后只读表；用户把清单删空时下次读取按同口径回落播种（规格 §4.3：
// own 态台账为空回落示例组，不返回空、不返回任何写死的真实清单——
// 作者实例的表里存的就是他迁入的那份，路径与所有用户一致）。
async function loadPumpServers(ctx: Ctx): Promise<PumpServerDbRow[]> {
  const db = ctx.db<typeof schema>();
  const existing = await db
    .select()
    .from(schema.pumpServers)
    .orderBy(asc(schema.pumpServers.sortOrder), asc(schema.pumpServers.id));
  if (existing.length > 0) return existing;
  const mode = await getBoardMode(ctx);
  const seed = mode === "own" ? PUMP_SERVERS : EXAMPLE_SERVERS;
  let order = 0;
  for (const s of seed) {
    order += 1;
    await db.insert(schema.pumpServers).values({
      name: s.name,
      sub: s.sub,
      tags: JSON.stringify(s.tags),
      status: JSON.stringify(s.status),
      freq: s.freq,
      demo: mode === "example" ? 1 : 0,
      sortOrder: order,
    });
  }
  return db
    .select()
    .from(schema.pumpServers)
    .orderBy(asc(schema.pumpServers.sortOrder), asc(schema.pumpServers.id));
}

const CATALOG_NAMES = new Set(CATALOG.map((e) => e.name));
const CATALOG_BY_NAME = new Map(CATALOG.map((e) => [e.name, e]));
const DEMO_ONLY_NAMES = new Set(
  CATALOG.filter((e) => e.demoOnly).map((e) => e.name),
);

// ── 看板状态（示例 / 本人） ─────────────────────────────────────────
// board_mode 存 settings 表：example＝示例状态（用户还没添置任何自己的
// 战利品，甲板展示内置示例数据，页面明确标注示例）；own＝用户自己的
// 状态。迁移 0006 按存量定初始值（已有台账数据＝own，全新安装＝example），
// settings 里没有这条时按 example 处理（全新安装口径）。
async function getBoardMode(ctx: Ctx): Promise<"example" | "own"> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "board_mode"))
    .limit(1);
  return rows[0]?.value === "own" ? "own" : "example";
}

// 示例状态 → 用户自己的状态（自动翻转，用户添置第一件自己的战利品时触发）：
// keepId 是用户刚动手的那一行——先标 owned 再清场，清场不动 owned 行；
// 其余行里示例专属条目（作者的服务器卡）直接删除，普通目录条目把示例
// 状态复位（点亮→未点亮、清 key 尾号/备注/定期任务记录，带公开版文案的
// 换成公开版），只剩一张干净的待领取目录 + 用户自己的那件。
async function flipToOwn(ctx: Ctx, keepId?: number): Promise<boolean> {
  const db = ctx.db<typeof schema>();
  if ((await getBoardMode(ctx)) !== "example") return false;
  if (keepId != null) {
    await db
      .update(schema.providers)
      .set({ owned: 1 })
      .where(eq(schema.providers.id, keepId));
  }
  const rows = await db.select().from(schema.providers);
  for (const r of rows) {
    if (r.owned === 1) continue;
    if (DEMO_ONLY_NAMES.has(r.name)) {
      await db
        .delete(schema.providers)
        .where(eq(schema.providers.id, r.id));
      continue;
    }
    const e = CATALOG_BY_NAME.get(r.name);
    await db
      .update(schema.providers)
      .set({
        status: "unclaimed",
        keyTail: "",
        note: "",
        taskCycle: "none",
        taskLastDoneAt: null,
        ...(e?.publicQuota ? { quotaText: e.publicQuota } : {}),
        ...(e?.publicContent ? { dailyDetail: e.publicContent } : {}),
      })
      .where(eq(schema.providers.id, r.id));
  }
  await db
    .insert(schema.settings)
    .values({ key: "board_mode", value: "own" })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: "own" },
    });
  return true;
}

// ── 已下架名单（用户 2026-11-15 拍板）：非 API 调度、且对他没实际用途的条目——
// 别家编程工具的产品内积分（他用 Codex/Muse）与只能在对方产品里花的产品内
// 羊毛整区。同步时从台账删除这些行，且目录里已无此条目、不会再插回。
const REMOVED_NAMES = new Set([
  // 工具福利下架 11 家
  "Telnyx",
  "Somark",
  "TRAE 大额",
  "TRAE",
  "Qoder 进阶",
  "Qoder",
  "WorkBuddy",
  "Zed",
  "Devin",
  "OpenCode",
  "ZCode",
  // 产品内羊毛整区下架 19 家
  "腾讯 CloudBase",
  "智谱 AutoClaw",
  "智谱积分",
  "华为云",
  "50X Energy",
  "Nace AI",
  "腾讯云",
  "腾讯",
  "秒悟",
  "MiniMax 智能体平台",
  "商汤小浣熊",
  "豆包电脑版",
  "华为果办 OfficeAce",
  "讯飞星火智能体",
  "灵犀",
  "腾讯 ima",
  "Ace Music",
  "MiniMax 生图",
  "新浪",
  // 2026-11-20 第二轮下架：除大羊毛推荐外，其余羊毛分区里未点亮的条目
  // 全部删除（已点亮一条不动；大羊毛 8 条不论状态豁免——其中未点亮的
  // DeepSeek、百度智能云不在此列；技能图鉴 efficiency 分区不在此列）
  "Reducto",
  "GitHub Models",
  "阿里云新人礼包",
  "阿里云百炼",
  "蚂蚁灵波",
  "阶跃星辰 StepFun",
  "智谱 BigModel",
  "Mistral",
  "NVIDIA Build",
  "超算互联网",
  "超算互联网小额",
  "甲骨文 Oracle",
  "Google Colab",
  "Microsoft Azure",
]);

const SEED: Array<
  Omit<
    ProviderRow,
    "id" | "createdAt" | "backer" | "groupKey" | "sortValue" | "featuredRank" | "owned" | "hidden"
  >
> = [
  {
    name: "魔搭社区",
    nameEn: "ModelScope",
    quotaText: "每天领点数，用来调用模型",
    dailyDetail: "可每天领点数来调用模型。每天共 250 魔粒（调用点数）：登录领 200，绑定阿里云再得 50；每次约扣 0.5／1／2 魔粒，当天过期，不累积。",
    refreshRule: "当天过期，不攒",
    rateLimit: "热门模型会限速，以页面显示为准",
    models: "DeepSeek、MiniMax、Qwen 等开源模型（API-Inference）",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    conditionText: "实名阿里云账号绑定 + 验证邮箱；仅限非商业用途",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 1,
  },
  {
    name: "Cloudflare Workers AI",
    nameEn: "Cloudflare Workers AI",
    quotaText: "每天免费用模型处理任务",
    dailyDetail: "可每天免费调用模型处理任务。每天给 10,000 Neurons（用量单位），约够小模型几百次、70B 级大模型 100 次；UTC 00:00 刷新，不累积。",
    refreshRule: "00:00 UTC 刷新，不滚存",
    rateLimit: "免费套餐超额停用，不扣费",
    models: "Llama 3.3 70B 等；少数前沿模型仅付费套餐",
    baseUrl: "",
    conditionText: "Cloudflare 账号即可；如注册要求绑卡，先停下问",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 2,
  },
  {
    name: "OpenRouter",
    nameEn: "OpenRouter",
    quotaText: "每天免费调用模型",
    dailyDetail: "可调用标着 :free 的免费模型来处理任务。每天 50 次，每分钟 20 次；一次性买过至少 $10 额度后，升到每天 1,000 次。",
    refreshRule: "按天刷新（:free 免费模型）",
    rateLimit: "20 次/分钟",
    models: ":free 后缀的免费模型（名单会变）",
    baseUrl: "",
    conditionText: "领取前先查有没有旧账号和旧 key，活着直接用，不要重复注册",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 3,
  },
  {
    name: "硅基流动",
    nameEn: "SiliconFlow",
    quotaText: "免费用小模型，新人另有赠金",
    dailyDetail: "可长期免费调用部分小模型，但调用速度有限制。国内站新用户另有 ¥16 赠金；免费模型每次调用为 ¥0。",
    refreshRule: "免费名单会变，以领取时 ¥0 标注为准",
    rateLimit: "免费模型固定限速，不随充值提升",
    models: "Qwen3-8B、Qwen2.5-7B、DeepSeek-R1-Distill-Qwen-7B、DeepSeek-OCR 等 ¥0 模型",
    baseUrl: "https://api.siliconflow.cn/v1",
    conditionText: "支付宝扫脸实名（国内站）",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 4,
  },
  {
    name: "火山方舟",
    nameEn: "Volcano Ark",
    quotaText: "试用各家模型，不用领",
    dailyDetail: "可分别试用平台上的模型，比较哪种适合你的活。每个模型一次性有 50 万 Token（按处理文字量计的额度），不用领，已经到手。",
    refreshRule: "试用额度，以平台规则为准",
    rateLimit: "",
    models: "平台各模型分别有试用额度",
    baseUrl: "",
    conditionText: "不用领",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 5,
  },
];

// ── 设置项读写（settings 键值表） ───────────────────────────────────
async function getSettingValue(ctx: Ctx, key: string): Promise<string> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return rows[0]?.value ?? "";
}

async function setSettingValue(
  ctx: Ctx,
  key: string,
  value: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value },
    });
}

// 被用户隐藏的出厂 Skill 名单（展示层，存 settings 的 JSON 数组）：
// 出厂目录只读不改，隐藏只是呈现层开关，设置里可恢复（规格 §7.2）。
async function getHiddenFactorySkills(ctx: Ctx): Promise<string[]> {
  const raw = await getSettingValue(ctx, "hidden_factory_skills");
  return parseJsonArray<string>(raw, []);
}

const userSkillShape = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string(),
  zone: z.enum(["general", "exclusive"]),
  tab: z.string(),
  sub: z.string(),
  sourceType: z.enum(["github", "url", "bundled", "none"]),
  sourceUrl: z.string(),
  sourcePath: z.string(),
  calls: z.number(),
  lastUsed: z.number().nullable(),
});
type UserSkillRow = typeof schema.userSkills.$inferSelect;

function toUserSkill(row: UserSkillRow): z.infer<typeof userSkillShape> {
  return {
    id: row.id,
    name: row.name,
    desc: row.desc,
    zone: row.zone,
    tab: row.tab,
    sub: row.sub,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    sourcePath: row.sourcePath,
    calls: row.calls,
    lastUsed: row.lastUsed ? row.lastUsed.getTime() : null,
  };
}

const userWorkflowShape = z.object({
  id: z.string(),
  zone: z.enum(["general", "exclusive"]),
  tab: z.string(),
  title: z.string(),
  purpose: z.string(),
  appliesTo: z.string(),
  steps: z.array(
    z.object({ skill: z.string(), branches: z.array(z.string()) }),
  ),
  calls: z.number(),
  lastCalledAt: z.number().nullable(),
});
type UserWorkflowRow = typeof schema.userWorkflows.$inferSelect;

function toUserWorkflow(
  row: UserWorkflowRow,
): z.infer<typeof userWorkflowShape> {
  return {
    id: row.id,
    zone: row.zone,
    tab: row.tab,
    title: row.title,
    purpose: row.purpose,
    appliesTo: row.appliesTo,
    steps: parseJsonArray<{ skill: string; branches: string[] }>(
      row.steps,
      [],
    ),
    calls: row.calls,
    lastCalledAt: row.lastCalledAt ? row.lastCalledAt.getTime() : null,
  };
}

export const Actions = {
  listProviders: defineAction({
    description: "列出 Token 池台账里的全部提供方，按台账顺序排列；同时返回看板状态 boardMode（example＝示例状态，甲板展示的是内置示例数据；own＝用户自己的状态）与资源调度图水源排的用户自定义顺序 pumpSourceOrder（空数组＝用出厂默认序）。",
    request: z.object({}),
    response: z.object({
      providers: z.array(providerShape),
      boardMode: z.enum(["example", "own"]),
      pumpSourceOrder: z.array(z.string()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.providers)
        .orderBy(asc(schema.providers.sortOrder), asc(schema.providers.id));
      const stats = await db.select().from(schema.gatewayStats);
      const statByName = new Map(stats.map((s) => [s.providerName, s]));
      return {
        providers: rows.map((r) => toProvider(r, statByName.get(r.name))),
        boardMode: await getBoardMode(ctx),
        pumpSourceOrder: parseJsonArray<string>(
          await getSettingValue(ctx, "pump_source_order"),
          [],
        ),
      };
    },
  }),

  getPumpServers: defineAction({
    description:
      "返回补给泵图上方服务器层的数据：读用户数据层 pump_servers 表（表为空时按看板状态播种一次：own 播作者本人的 7 台、example 播虚构示例组）。demo=true 表示当前整组仍是虚构示例组，页面挂示例标。",
    request: z.object({}),
    response: z.object({
      servers: z.array(pumpServerRowShape),
      demo: z.boolean(),
    }),
    handler: async (
      ctx,
    ): Promise<{ servers: PumpServerRow[]; demo: boolean }> => {
      const rows = await loadPumpServers(ctx);
      return {
        servers: rows.map(toPumpServerRow),
        demo: rows.length > 0 && rows.every((r) => r.demo === 1),
      };
    },
  }),

  addPumpServer: defineAction({
    description:
      "往补给泵图服务器清单里新增一台（用户数据层）：名称、副标题、职责标签、状态行（文字＋语气）、分页（hot=常用页 / cold=不常用页）。",
    request: z.object({
      name: z.string().min(1).max(60),
      sub: z.string().max(80).default(""),
      tags: z.array(z.string().min(1).max(30)).max(6).default([]),
      status: z
        .array(
          z.object({
            text: z.string().min(1).max(60),
            tone: z.enum(["ok", "due", "warn", "muted"]),
          }),
        )
        .max(6)
        .default([]),
      freq: z.enum(["hot", "cold"]).default("hot"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await loadPumpServers(ctx);
      const rows = await db.select().from(schema.pumpServers);
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
      const result = await db
        .insert(schema.pumpServers)
        .values({
          name: args.name.trim(),
          sub: args.sub.trim(),
          tags: JSON.stringify(args.tags.map((t) => t.trim())),
          status: JSON.stringify(args.status),
          freq: args.freq,
          demo: 0,
          sortOrder: maxOrder + 1,
        })
        .returning({ id: schema.pumpServers.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPumpServer: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updatePumpServer: defineAction({
    description:
      "修改一台服务器的名称、副标题、职责标签、状态行或分页；被用户动过的行转出示例组（demo 清零）。",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(60).optional(),
      sub: z.string().max(80).optional(),
      tags: z.array(z.string().min(1).max(30)).max(6).optional(),
      status: z
        .array(
          z.object({
            text: z.string().min(1).max(60),
            tone: z.enum(["ok", "due", "warn", "muted"]),
          }),
        )
        .max(6)
        .optional(),
      freq: z.enum(["hot", "cold"]).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const patch: Partial<PumpServerDbRow> = { demo: 0 };
      if (args.name !== undefined) patch.name = args.name.trim();
      if (args.sub !== undefined) patch.sub = args.sub.trim();
      if (args.tags !== undefined)
        patch.tags = JSON.stringify(args.tags.map((t) => t.trim()));
      if (args.status !== undefined) patch.status = JSON.stringify(args.status);
      if (args.freq !== undefined) patch.freq = args.freq;
      await db
        .update(schema.pumpServers)
        .set(patch)
        .where(eq(schema.pumpServers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePumpServer: defineAction({
    description: "从补给泵图服务器清单里删除一台（用户数据层）。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.pumpServers)
        .where(eq(schema.pumpServers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  reorderPumpServers: defineAction({
    description:
      "按给定顺序重排补给泵图服务器清单（用户在图上拖动调换左右位置后落库）：ids 为全部服务器 id 的新顺序，逐个写入 sortOrder。只写用户数据层，不动出厂种子。",
    request: z.object({
      ids: z.array(z.number().int().positive()).min(1).max(50),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.pumpServers);
      const known = new Set(rows.map((r) => r.id));
      const ids = args.ids.filter((id) => known.has(id));
      if (ids.length === 0) return { ok: true };
      const statements: BatchItem<"sqlite">[] = ids.map((id, i) =>
        db
          .update(schema.pumpServers)
          .set({ sortOrder: i })
          .where(eq(schema.pumpServers.id, id)),
      );
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setPumpSourceOrder: defineAction({
    description:
      "保存资源调度图水源排的左右顺序（＝抽水优先顺序）：names 为水源名数组（自有通道槽位记为 __self__），存用户数据层 settings。用户拖动调序后落库；未设置时页面按出厂默认序（先烧快过期的）排。出厂种子不带此顺序。",
    request: z.object({
      names: z.array(z.string().min(1).max(80)).max(40),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      await setSettingValue(
        ctx,
        "pump_source_order",
        JSON.stringify(args.names),
      );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  seedProviders: defineAction({
    description: "台账为空时写入首批五家（四家待领 + 火山方舟已点亮）；已有记录时不做任何改动。",
    request: z.object({}),
    response: z.object({ seeded: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.providers).limit(1);
      if (existing.length > 0) return { seeded: 0 };
      for (const row of SEED) {
        await db.insert(schema.providers).values(row);
      }
      ctx.invalidateQueries();
      return { seeded: SEED.length };
    },
  }),

  syncCatalog: defineAction({
    description:
      "把全量目录（25 家）同步进台账：先删下架名单里的行（第一轮：非 API 调度且无实际用途的工具福利与产品内羊毛整区；第二轮：其余羊毛分区里未点亮的 14 家，大羊毛推荐 8 条豁免），再按名称去重（同名多行只保留带用户数据最多的一行，其余删除）；缺的按名补入，同名已存在绝不重复插入；已有的只补结构字段（分类/排序值/推荐位，其中排序值按实际可用价值换算：每日刷新×30、每周×30/7、代金券×0.5、免费不限量按附带赠金算）。看板状态决定示例层：示例状态（example）下目录的已点亮状态、示例备注、定期任务种子与示例专属条目（作者本人的服务器卡）一并入账，拼出完整的示例看板；用户自己的状态（own）下只入目录本体——全部未点亮、不带示例备注、文案用公开版、示例专属条目不入账，已有行也不再被示例层触碰。绝不覆盖 key 尾号和用户改过的状态。",
    request: z.object({}),
    response: z.object({
      inserted: z.number(),
      updated: z.number(),
      total: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const allRowsRaw = await db.select().from(schema.providers);
      // 先删下架名单：这些行从台账移除，目录里也已删除，同步不会再插回
      const allRows: ProviderRow[] = [];
      for (const r of allRowsRaw) {
        if (REMOVED_NAMES.has(r.name)) {
          await db
            .delete(schema.providers)
            .where(eq(schema.providers.id, r.id));
        } else {
          allRows.push(r);
        }
      }
      // 按名称去重：同名多行只保留一行（优先保留带用户数据的——key 尾号、
      // 备注、非默认状态、定期任务记录；并列时保留 id 最小的一行），其余删除，
      // 防止并发同步或重复插入让同一家出现多张卡、计数虚增。
      const groups = new Map<string, ProviderRow[]>();
      for (const r of allRows) {
        const g = groups.get(r.name);
        if (g) g.push(r);
        else groups.set(r.name, [r]);
      }
      const userDataScore = (r: ProviderRow): number =>
        (r.keyTail !== "" ? 1 : 0) +
        (r.note !== "" ? 1 : 0) +
        (r.status !== "unclaimed" ? 1 : 0) +
        (r.taskCycle !== "none" || r.taskLastDoneAt != null ? 1 : 0);
      const rows: ProviderRow[] = [];
      for (const g of groups.values()) {
        const sorted = [...g].sort(
          (a, b) => userDataScore(b) - userDataScore(a) || a.id - b.id,
        );
        const keeper = sorted[0];
        if (!keeper) continue;
        rows.push(keeper);
        for (const dup of sorted.slice(1)) {
          await db
            .delete(schema.providers)
            .where(eq(schema.providers.id, dup.id));
        }
      }
      const mode = await getBoardMode(ctx);
      const byName = new Map(rows.map((r) => [r.name, r]));
      let maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
      let inserted = 0;
      let updated = 0;
      for (const e of CATALOG) {
        // 示例专属条目（作者本人的服务器卡）：只在示例状态入账；
        // 用户自己的状态里不插入，已有的（作者本人实例）也原样不动。
        // 唯一例外（2026-11-20 文案轮）：天翼云电脑卡面旧文案带时效语境
        // 「昨天刚到手」，台账里还是这句系统原文时定向换掉，用户自己
        // 改过的文案不动。
        if (e.demoOnly && mode !== "example") {
          const exRow = byName.get(e.name);
          if (
            e.name === "天翼云电脑" &&
            exRow &&
            exRow.quotaText === "免费云电脑：4 核 8G、Windows，昨天刚到手"
          ) {
            await db
              .update(schema.providers)
              .set({ quotaText: e.quota })
              .where(eq(schema.providers.id, exRow.id));
            updated++;
          }
          continue;
        }
        // 文案按看板状态取版：示例状态用目录原文（作者口径），
        // 用户自己的状态用公开版（没有公开版的条目两版同文）
        const quota = mode === "example" ? e.quota : (e.publicQuota ?? e.quota);
        const content =
          mode === "example" ? e.content : (e.publicContent ?? e.content);
        const ex = byName.get(e.name);
        if (ex) {
          const patch: Partial<ProviderRow> = {
            groupKey: e.group,
            sortValue: effectiveValue(e),
            featuredRank: e.featuredRank ?? 0,
          };
          // 目录备注（示例数据的一部分）：只在示例状态、且台账备注还空着
          // 时补入，不覆盖用户写过的备注
          if (mode === "example" && e.note && ex.note === "") {
            patch.note = e.note;
          }
          // 状态用语收口：早期种子/目录写过的「已在册」原文改为两档口径；
          // 只命中系统写过的原文，用户自己改过的文案不动
          if (ex.dailyDetail.includes("已在册")) {
            patch.dailyDetail = content;
          }
          if (ex.note === "已在册，不用领") {
            patch.note = "不用领，额度已到手";
          }
          if (ex.conditionText === "已在册") {
            patch.conditionText = "不用领";
          }
          // 文案刷新（双机版，2026-11-17）：agent-desktop 已装上 Mac，
          // 旧详情只写 Windows；台账里还是系统写过的旧原文时换成目录
          // 新文案，用户自己改过的详情不动
          if (
            e.name === "agent-desktop" &&
            ex.dailyDetail ===
              "替你在 Windows 电脑上点软件按钮、切窗口、看截图。重点是能操作那些不能靠输指令控制的软件；已装好，已在电脑上实测通过。"
          ) {
            patch.dailyDetail = content;
          }
          // 文案刷新（2026-11-20 文案轮）：三条详情里写给作者本人的
          // 语境句（Kaggle「已接管，直接派活即可」、共享记忆库的内部
          // 代号、Scrapling 的具体站点名）——台账里还是带这些字样的
          // 系统原文时换成目录新文案，用户自己改过的详情不动
          if (
            (e.name === "Kaggle" && ex.dailyDetail.includes("已接管")) ||
            (e.name === "共享记忆库" && ex.dailyDetail.includes("三体")) ||
            (e.name === "Scrapling" && ex.dailyDetail.includes("T-Motor"))
          ) {
            patch.dailyDetail = content;
          }
          if (e.name === "Kaggle" && ex.note === "已接管，直接派活即可") {
            patch.note = "";
          }
          // 文案刷新（2026-11-20 卡墙减负）：Google Cloud / AWS 卡面
          // 第二行原是额度到账明细，按「卡面只留一句用途、明细进详情」
          // 定向换成用途句；金额与到期仍在详情（dailyDetail）里，
          // 用户自己改过的卡面文案不动
          if (
            (e.name === "Google Cloud" &&
              ex.quotaText === "$300 试用赠金已在手，外加 e2-micro 永久免费") ||
            (e.name === "AWS" &&
              ex.quotaText === "账号已开通：$200 额度全到账（首笔 $100 + 任务 $100）")
          ) {
            patch.quotaText = quota;
          }
          // 定期任务种子（示例数据的一部分）：仅示例状态、且台账从未
          // 配置过（周期为无、且无完成记录）时应用一次；之后以
          // completeTask 打卡和用户设置为准，同步不再覆盖
          if (
            mode === "example" &&
            e.taskCycle &&
            ex.taskCycle === "none" &&
            ex.taskLastDoneAt == null
          ) {
            patch.taskCycle = e.taskCycle;
            if (e.taskSeedDoneDay) {
              patch.taskLastDoneAt = new Date(`${e.taskSeedDoneDay}T01:00:00Z`);
            }
          }
          // 已到手补点亮（示例数据的一部分）：仅示例状态应用——目录标了
          // litStatus、台账还停在未点亮两档（unclaimed / check_old）时按
          // 目录点亮，拼出完整的示例看板。用户自己的状态下绝不替用户
          // 点亮：他领没领只由他自己的记录说了算。
          if (
            mode === "example" &&
            e.litStatus &&
            (ex.status === "unclaimed" || ex.status === "check_old")
          ) {
            patch.status = e.litStatus;
            patch.refreshRule = e.cycle;
          }
          // 首次同步（backer 还空着）才对齐目录文案，之后尊重用户编辑
          if (ex.backer === "") {
            patch.backer = e.backer;
            patch.nameEn = e.nameEn || ex.nameEn;
            patch.quotaText = quota;
            patch.dailyDetail = content;
            patch.refreshRule = e.cycle;
            if (
              mode === "example" &&
              e.litStatus &&
              (ex.status === "unclaimed" || ex.status === "check_old")
            ) {
              patch.status = e.litStatus;
            }
          }
          await db
            .update(schema.providers)
            .set(patch)
            .where(eq(schema.providers.id, ex.id));
          updated++;
        } else {
          maxOrder += 1;
          await db.insert(schema.providers).values({
            name: e.name,
            nameEn: e.nameEn,
            quotaText: quota,
            dailyDetail: content,
            refreshRule: e.cycle,
            rateLimit: "",
            models: "",
            baseUrl: "",
            conditionText: "",
            backer: e.backer,
            groupKey: e.group,
            sortValue: effectiveValue(e),
            featuredRank: e.featuredRank ?? 0,
            status: mode === "example" ? (e.litStatus ?? "unclaimed") : "unclaimed",
            taskCycle: mode === "example" ? (e.taskCycle ?? "none") : "none",
            taskLastDoneAt:
              mode === "example" && e.taskSeedDoneDay
                ? new Date(`${e.taskSeedDoneDay}T01:00:00Z`)
                : null,
            keyTail: "",
            note: mode === "example" ? (e.note ?? "") : "",
            sortOrder: maxOrder,
          });
          inserted++;
        }
      }
      ctx.invalidateQueries();
      return { inserted, updated, total: CATALOG.length };
    },
  }),

  updateProvider: defineAction({
    description: "更新一家的领取状态、key 尾号、备注及台账字段。name 只许改用户自添的卡：出厂目录卡按名对齐目录，改名会被拒绝（其余字段可覆盖，存用户数据层）。示例状态下调用＝用户开始添置自己的战利品：这一行标为用户所有，并自动翻转到用户自己的状态（示例数据清场）。",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(80).optional(),
      status: statusEnum.optional(),
      taskCycle: taskCycleEnum.optional(),
      keyTail: z.string().max(16).optional(),
      note: z.string().max(500).optional(),
      quotaText: z.string().max(200).optional(),
      dailyDetail: z.string().max(500).optional(),
      refreshRule: z.string().max(200).optional(),
      rateLimit: z.string().max(200).optional(),
      models: z.string().max(500).optional(),
      conditionText: z.string().max(500).optional(),
      baseUrl: z.string().max(300).optional(),
      backer: z.string().max(120).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const { id, ...patch } = args;
      // 出厂目录卡的名字是目录对齐键，不许改名（改名会让同步把目录条目
      // 当新卡再插一份）；用户自添的卡可改名。其余字段都是用户层覆盖。
      if (patch.name !== undefined) {
        const rows = await db
          .select()
          .from(schema.providers)
          .where(eq(schema.providers.id, id))
          .limit(1);
        const row = rows[0];
        if (!row) throw new Error("updateProvider: 找不到这家提供方");
        if (CATALOG_NAMES.has(row.name) && patch.name.trim() !== row.name) {
          throw new Error("出厂卡不能改名（目录按名对齐），其他字段都可以改");
        }
      }
      // 示例状态下亲手改一行＝添置自己的第一件战利品：先翻转清场
      // （这一行标 owned 保留），再落用户的修改
      await flipToOwn(ctx, id);
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === "string") clean[k] = v.trim();
      }
      if (Object.keys(clean).length > 0) {
        await db
          .update(schema.providers)
          .set(clean)
          .where(eq(schema.providers.id, id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  completeTask: defineAction({
    description:
      "给一家的定期任务打卡：把上次完成时间记为现在，该家卡片上的待办红点随即熄灭（下个周期自动再亮）。按 id 或 name 指定一家，二选一。示例状态下打卡＝这家已被用户实际领用，自动翻转到用户自己的状态（示例数据清场，这一行保留）。",
    request: z.object({
      id: z.number().int().positive().optional(),
      name: z.string().min(1).max(80).optional(),
    }),
    response: z.object({
      ok: z.literal(true),
      id: z.number(),
      name: z.string(),
      taskCycle: taskCycleEnum,
      taskLastDoneAt: z.number(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      ok: true;
      id: number;
      name: string;
      taskCycle: z.infer<typeof taskCycleEnum>;
      taskLastDoneAt: number;
    }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.providers);
      const row =
        args.id != null
          ? rows.find((r) => r.id === args.id)
          : args.name != null
            ? rows.find((r) => r.name === args.name)
            : undefined;
      if (!row) throw new Error("completeTask: 找不到这家提供方");
      // 示例状态下打卡＝这家是用户自己的战利品：翻转清场，这行保留
      await flipToOwn(ctx, row.id);
      const now = new Date();
      await db
        .update(schema.providers)
        .set({ taskLastDoneAt: now })
        .where(eq(schema.providers.id, row.id));
      ctx.invalidateQueries();
      return {
        ok: true,
        id: row.id,
        name: row.name,
        taskCycle: row.taskCycle,
        taskLastDoneAt: now.getTime(),
      };
    },
  }),

  syncGatewayStats: defineAction({
    description:
      "写入网关（new-api）真实调用统计：按渠道名逐条 upsert 近 7 天调用次数、近 7 天消耗 token 数与最近一次调用时间（毫秒时间戳，可为 null），供每日任务聚合网关日志后调用；补给泵图的水源边据此优先按真实调用绘制。",
    request: z.object({
      stats: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            calls7d: z.number().int().min(0),
            tokens7d: z.number().int().min(0),
            lastCallAt: z.number().int().positive().nullable().optional(),
          }),
        )
        .min(1)
        .max(50),
    }),
    response: z.object({ ok: z.literal(true), written: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; written: number }> {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      let written = 0;
      for (const s of args.stats) {
        const lastCallAt =
          s.lastCallAt != null ? new Date(s.lastCallAt) : null;
        const existing = await db
          .select()
          .from(schema.gatewayStats)
          .where(eq(schema.gatewayStats.providerName, s.name))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(schema.gatewayStats)
            .set({
              calls7d: s.calls7d,
              tokens7d: s.tokens7d,
              lastCallAt,
              updatedAt: now,
            })
            .where(eq(schema.gatewayStats.providerName, s.name));
        } else {
          await db.insert(schema.gatewayStats).values({
            providerName: s.name,
            calls7d: s.calls7d,
            tokens7d: s.tokens7d,
            lastCallAt,
            updatedAt: now,
          });
        }
        written++;
      }
      ctx.invalidateQueries();
      return { ok: true, written };
    },
  }),

  addProvider: defineAction({
    description: "往台账里新增一家提供方（用户自己的战利品，进用户数据层，出厂目录不动）。groupKey 指定落哪个板块（compute=免费算力 / api=免费Token（API可调度） / tool=工具福利，呈现并入免费算力）。示例状态下新增＝自动翻转到用户自己的状态（示例数据清场）。",
    request: z.object({
      name: z.string().min(1).max(80),
      groupKey: z.enum(["compute", "api", "tool"]).default("tool"),
      nameEn: z.string().max(80).default(""),
      quotaText: z.string().max(200).default(""),
      dailyDetail: z.string().max(500).default(""),
      refreshRule: z.string().max(200).default(""),
      rateLimit: z.string().max(200).default(""),
      models: z.string().max(500).default(""),
      baseUrl: z.string().max(300).default(""),
      conditionText: z.string().max(500).default(""),
      backer: z.string().max(120).default(""),
      note: z.string().max(500).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 新增的必然是用户自己的战利品：示例状态下先翻转清场
      await flipToOwn(ctx);
      const rows = await db.select().from(schema.providers);
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
      const result = await db
        .insert(schema.providers)
        .values({
          name: args.name.trim(),
          nameEn: args.nameEn.trim(),
          quotaText: args.quotaText.trim(),
          dailyDetail: args.dailyDetail.trim(),
          refreshRule: args.refreshRule.trim(),
          rateLimit: args.rateLimit.trim(),
          models: args.models.trim(),
          baseUrl: args.baseUrl.trim(),
          conditionText: args.conditionText.trim(),
          backer: args.backer.trim(),
          groupKey: args.groupKey,
          sortValue: 0,
          featuredRank: 0,
          note: args.note.trim(),
          status: "unclaimed",
          keyTail: "",
          owned: 1,
          sortOrder: maxOrder + 1,
        })
        .returning({ id: schema.providers.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addProvider: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deleteProvider: defineAction({
    description: "从台账里删除一家提供方（用户新增的记录用）。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.providers)
        .where(eq(schema.providers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setProviderHidden: defineAction({
    description:
      "隐藏或恢复一张台账卡（展示层开关）：出厂卡只藏不删走这条；隐藏只影响呈现与计数，台账行本身不动，也不触发示例状态翻转。",
    request: z.object({
      id: z.number().int().positive(),
      hidden: z.boolean(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.providers)
        .set({ hidden: args.hidden ? 1 : 0 })
        .where(eq(schema.providers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listUserAtlas: defineAction({
    description:
      "读技能图鉴的用户数据层：用户自加 Skill、用户自建工作流、被隐藏的出厂 Skill 名单。页面与出厂目录/注册表合并呈现，出厂层只读不改。",
    request: z.object({}),
    response: z.object({
      skills: z.array(userSkillShape),
      workflows: z.array(userWorkflowShape),
      hiddenFactorySkills: z.array(z.string()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const skills = await db
        .select()
        .from(schema.userSkills)
        .orderBy(asc(schema.userSkills.id));
      const workflows = await db
        .select()
        .from(schema.userWorkflows)
        .orderBy(asc(schema.userWorkflows.createdAt));
      return {
        skills: skills.map(toUserSkill),
        workflows: workflows.map(toUserWorkflow),
        hiddenFactorySkills: await getHiddenFactorySkills(ctx),
      };
    },
  }),

  addUserSkill: defineAction({
    description:
      "自加一个 Skill 进用户数据层（规格 §7.2）：名称、一句简介、归属（通用区标签或业务专属组）、来源字段（§5.3 结构，选填）。名称与出厂目录或已有自加 Skill 重名时拒绝。",
    request: z.object({
      name: z.string().min(1).max(80),
      desc: z.string().min(1).max(200),
      zone: z.enum(["general", "exclusive"]),
      tab: z.string().min(1).max(20),
      sub: z.string().max(40).default(""),
      sourceType: z.enum(["github", "url", "bundled", "none"]).default("none"),
      sourceUrl: z.string().max(300).default(""),
      sourcePath: z.string().max(200).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const name = args.name.trim();
      const existing = await db
        .select()
        .from(schema.userSkills)
        .where(eq(schema.userSkills.name, name))
        .limit(1);
      if (existing.length > 0) {
        throw new Error(`已有一个自加 Skill 叫「${name}」，换个名字`);
      }
      const result = await db
        .insert(schema.userSkills)
        .values({
          name,
          desc: args.desc.trim(),
          zone: args.zone,
          tab: args.tab,
          sub: args.sub.trim(),
          sourceType: args.sourceType,
          sourceUrl: args.sourceUrl.trim(),
          sourcePath: args.sourcePath.trim(),
        })
        .returning({ id: schema.userSkills.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addUserSkill: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateUserSkill: defineAction({
    description:
      "编辑一个用户自加 Skill 的简介、归属、分组小字与来源字段（名称是身份键，不可改名）。",
    request: z.object({
      id: z.number().int().positive(),
      desc: z.string().min(1).max(200).optional(),
      zone: z.enum(["general", "exclusive"]).optional(),
      tab: z.string().min(1).max(20).optional(),
      sub: z.string().max(40).optional(),
      sourceType: z.enum(["github", "url", "bundled", "none"]).optional(),
      sourceUrl: z.string().max(300).optional(),
      sourcePath: z.string().max(200).optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const { id, ...patch } = args;
      const clean: Partial<UserSkillRow> = {};
      if (patch.desc !== undefined) clean.desc = patch.desc.trim();
      if (patch.zone !== undefined) clean.zone = patch.zone;
      if (patch.tab !== undefined) clean.tab = patch.tab;
      if (patch.sub !== undefined) clean.sub = patch.sub.trim();
      if (patch.sourceType !== undefined) clean.sourceType = patch.sourceType;
      if (patch.sourceUrl !== undefined) clean.sourceUrl = patch.sourceUrl.trim();
      if (patch.sourcePath !== undefined)
        clean.sourcePath = patch.sourcePath.trim();
      if (Object.keys(clean).length > 0) {
        await db
          .update(schema.userSkills)
          .set(clean)
          .where(eq(schema.userSkills.id, id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteUserSkill: defineAction({
    description:
      "删除一个用户自加 Skill（只删用户数据层；引用它在的工作流节点保留步位、呈现「条目已删除」，链不断）。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.userSkills)
        .where(eq(schema.userSkills.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addUserWorkflow: defineAction({
    description:
      "自建一条工作流进用户注册表（规格 §7.3）：命名、用途、适用、归属（通用区标签或业务专属组）、按步序挑 Skill 组链（步骤可带分支 Skill，可引用出厂与自加 Skill）。系统生成稳定 ID wf-user-<slug>，与出厂线同格按 calls 排序。",
    request: z.object({
      title: z.string().min(1).max(60),
      purpose: z.string().max(200).default(""),
      appliesTo: z.string().max(200).default(""),
      zone: z.enum(["general", "exclusive"]),
      tab: z.string().min(1).max(20),
      steps: z
        .array(
          z.object({
            skill: z.string().min(1).max(80),
            branches: z.array(z.string().min(1).max(80)).max(8).default([]),
          }),
        )
        .min(1)
        .max(20),
    }),
    response: z.object({ id: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const slug =
        args.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9一-鿿]+/g, "-")
          .replace(/^-+|-+$/g, "") || "line";
      let id = `wf-user-${slug}`;
      const clash = await db
        .select()
        .from(schema.userWorkflows)
        .where(eq(schema.userWorkflows.id, id))
        .limit(1);
      if (clash.length > 0) id = `${id}-${Date.now().toString(36)}`;
      await db.insert(schema.userWorkflows).values({
        id,
        zone: args.zone,
        tab: args.tab,
        title: args.title.trim(),
        purpose: args.purpose.trim(),
        appliesTo: args.appliesTo.trim(),
        steps: JSON.stringify(
          args.steps.map((s) => ({ skill: s.skill, branches: s.branches })),
        ),
      });
      ctx.invalidateQueries();
      return { id };
    },
  }),

  deleteUserWorkflow: defineAction({
    description: "删除一条用户自建工作流（只删用户注册表，出厂线不动）。",
    request: z.object({ id: z.string().min(1).max(120) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.userWorkflows)
        .where(eq(schema.userWorkflows.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setFactorySkillHidden: defineAction({
    description:
      "隐藏或恢复一个出厂 Skill（展示层开关，存 settings 名单）：出厂目录本体只读不删，隐藏只影响它在零散清单/本体卡等独立陈列位的呈现，工作流链里的节点照常保留。",
    request: z.object({ name: z.string().min(1).max(80), hidden: z.boolean() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const current = await getHiddenFactorySkills(ctx);
      const next = args.hidden
        ? [...new Set([...current, args.name])]
        : current.filter((n) => n !== args.name);
      await setSettingValue(ctx, "hidden_factory_skills", JSON.stringify(next));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getSettings: defineAction({
    description: "读设置抽屉需要的配置项：网关接入地址（gateway_url）。",
    request: z.object({}),
    response: z.object({ gatewayUrl: z.string() }),
    async handler(ctx) {
      return { gatewayUrl: await getSettingValue(ctx, "gateway_url") };
    },
  }),

  setGatewayUrl: defineAction({
    description:
      "保存网关接入地址（设置项）：网关的真实调用统计由网关侧每日任务经 syncGatewayStats 回填，泵图据此绘制。",
    request: z.object({ url: z.string().max(300) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      await setSettingValue(ctx, "gateway_url", args.url.trim());
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getSelfIdentity: defineAction({
    description:
      "读资源调度图「自有通道」槽位的运行时身份：用户自己的 Muse 的名字与头像（都存用户数据层——名字在 settings、头像在 blobs）。未设置时返回 null，页面回落「我的 Muse」与通用图标；出厂数据里不带任何具体名字与头像。",
    request: z.object({}),
    response: z.object({
      name: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
    async handler(ctx) {
      const name = (await getSettingValue(ctx, "self_name")).trim();
      const blobKey = await getSettingValue(ctx, "self_avatar_key");
      let avatarUrl: string | null = null;
      if (blobKey) {
        try {
          avatarUrl = await ctx.blobs.getUrl(blobKey);
        } catch {
          avatarUrl = null;
        }
      }
      return { name: name || null, avatarUrl };
    },
  }),

  setSelfIdentity: defineAction({
    description:
      "设置「自有通道」槽位的身份（只写本实例的用户数据层）：名字＝用户自己的 Muse 的名字；头像为 PNG/JPEG/WebP/GIF 图片（base64，上限 2MB），或 removeAvatar=true 移除头像。出厂数据与开源快照不带任何具体身份。",
    request: z.object({
      name: z.string().max(24),
      avatar: z
        .object({
          dataBase64: z.string().max(2_800_000),
          mimeType: z.string().max(40),
        })
        .optional(),
      removeAvatar: z.boolean().optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      await setSettingValue(ctx, "self_name", args.name.trim());
      if (args.removeAvatar) {
        const old = await getSettingValue(ctx, "self_avatar_key");
        if (old) await ctx.blobs.delete(old);
        await setSettingValue(ctx, "self_avatar_key", "");
      } else if (args.avatar) {
        const mime = args.avatar.mimeType;
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
        ) {
          throw new Error("头像只支持 PNG / JPEG / WebP / GIF 图片。");
        }
        const bytes = Buffer.from(args.avatar.dataBase64, "base64");
        if (bytes.length === 0 || bytes.length > 2_000_000) {
          throw new Error("头像图片为空或超过 2MB。");
        }
        const key = "self/avatar";
        await ctx.blobs.put(key, bytes, { contentType: mime });
        await setSettingValue(ctx, "self_avatar_key", key);
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setBoardMode: defineAction({
    description:
      "手动切换看板状态（设置项，规格 §7.5）：example=示例状态 / own=我的看板。只切换呈现口径，不删除任何已登记数据；切回 example 后客户端会再跑一次目录同步把示例层补齐。",
    request: z.object({ mode: z.enum(["example", "own"]) }),
    response: z.object({ ok: z.literal(true), mode: z.enum(["example", "own"]) }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; mode: "example" | "own" }> {
      await setSettingValue(ctx, "board_mode", args.mode);
      ctx.invalidateQueries();
      return { ok: true, mode: args.mode };
    },
  }),

  exportData: defineAction({
    description:
      "导出用户数据为一份 JSON：台账全部行、泵图服务器清单、用户自加 Skill、用户自建工作流、被隐藏的出厂 Skill 名单与看板状态，供换机器备份/恢复（设置抽屉的导出按钮）。",
    request: z.object({}),
    response: z.object({
      version: z.literal(1),
      boardMode: z.enum(["example", "own"]),
      providers: z.array(z.record(z.string(), z.unknown())),
      pumpServers: z.array(pumpServerRowShape),
      userSkills: z.array(userSkillShape),
      userWorkflows: z.array(userWorkflowShape),
      hiddenFactorySkills: z.array(z.string()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const providerRows = await db
        .select()
        .from(schema.providers)
        .orderBy(asc(schema.providers.sortOrder), asc(schema.providers.id));
      const serverRows = await loadPumpServers(ctx);
      const skills = await db.select().from(schema.userSkills);
      const workflows = await db.select().from(schema.userWorkflows);
      return {
        version: 1 as const,
        boardMode: await getBoardMode(ctx),
        providers: providerRows.map((r) => ({
          ...r,
          taskLastDoneAt: r.taskLastDoneAt ? r.taskLastDoneAt.getTime() : null,
          createdAt: r.createdAt.getTime(),
        })),
        pumpServers: serverRows.map(toPumpServerRow),
        userSkills: skills.map(toUserSkill),
        userWorkflows: workflows.map(toUserWorkflow),
        hiddenFactorySkills: await getHiddenFactorySkills(ctx),
      };
    },
  }),

  importData: defineAction({
    description:
      "导入 exportData 导出的 JSON 恢复用户数据：台账按名 upsert、服务器清单整表替换、自加 Skill 按名 upsert、自建工作流按 ID upsert、隐藏名单与看板状态一并恢复。出厂目录/注册表不在导入范围。",
    request: z.object({
      data: z.object({
        boardMode: z.enum(["example", "own"]).optional(),
        providers: z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              nameEn: z.string().max(80).default(""),
              quotaText: z.string().max(500).default(""),
              dailyDetail: z.string().max(1000).default(""),
              refreshRule: z.string().max(200).default(""),
              rateLimit: z.string().max(200).default(""),
              models: z.string().max(500).default(""),
              baseUrl: z.string().max(300).default(""),
              conditionText: z.string().max(500).default(""),
              backer: z.string().max(120).default(""),
              groupKey: z.string().max(20).default("tool"),
              sortValue: z.number().default(0),
              featuredRank: z.number().int().default(0),
              status: statusEnum.default("unclaimed"),
              taskCycle: taskCycleEnum.default("none"),
              taskLastDoneAt: z.number().nullable().default(null),
              keyTail: z.string().max(16).default(""),
              note: z.string().max(500).default(""),
              owned: z.number().int().default(0),
              hidden: z.number().int().default(0),
              sortOrder: z.number().int().default(0),
            }),
          )
          .max(500)
          .default([]),
        pumpServers: z
          .array(
            z.object({
              name: z.string().min(1).max(60),
              sub: z.string().max(80).default(""),
              tags: z.array(z.string().max(30)).max(6).default([]),
              status: z
                .array(
                  z.object({
                    text: z.string().max(60),
                    tone: z.enum(["ok", "due", "warn", "muted"]),
                  }),
                )
                .max(6)
                .default([]),
              freq: z.enum(["hot", "cold"]).default("hot"),
              demo: z.boolean().default(false),
            }),
          )
          .max(100)
          .default([]),
        userSkills: z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              desc: z.string().max(200).default(""),
              zone: z.enum(["general", "exclusive"]).default("general"),
              tab: z.string().max(20).default("A"),
              sub: z.string().max(40).default(""),
              sourceType: z
                .enum(["github", "url", "bundled", "none"])
                .default("none"),
              sourceUrl: z.string().max(300).default(""),
              sourcePath: z.string().max(200).default(""),
              calls: z.number().int().min(0).default(0),
              lastUsed: z.number().nullable().default(null),
            }),
          )
          .max(500)
          .default([]),
        userWorkflows: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              zone: z.enum(["general", "exclusive"]).default("general"),
              tab: z.string().max(20).default("A"),
              title: z.string().min(1).max(60),
              purpose: z.string().max(200).default(""),
              appliesTo: z.string().max(200).default(""),
              steps: z
                .array(
                  z.object({
                    skill: z.string().min(1).max(80),
                    branches: z.array(z.string().max(80)).max(8).default([]),
                  }),
                )
                .max(20)
                .default([]),
              calls: z.number().int().min(0).default(0),
              lastCalledAt: z.number().nullable().default(null),
            }),
          )
          .max(200)
          .default([]),
        hiddenFactorySkills: z.array(z.string().max(80)).max(500).default([]),
      }),
    }),
    response: z.object({
      ok: z.literal(true),
      providers: z.number(),
      pumpServers: z.number(),
      userSkills: z.number(),
      userWorkflows: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const d = args.data;
      // 台账按名 upsert（导入是恢复语义：同名以导入文件为准）
      let pCount = 0;
      for (const p of d.providers) {
        const values = {
          name: p.name,
          nameEn: p.nameEn,
          quotaText: p.quotaText,
          dailyDetail: p.dailyDetail,
          refreshRule: p.refreshRule,
          rateLimit: p.rateLimit,
          models: p.models,
          baseUrl: p.baseUrl,
          conditionText: p.conditionText,
          backer: p.backer,
          groupKey: p.groupKey,
          sortValue: p.sortValue,
          featuredRank: p.featuredRank,
          status: p.status,
          taskCycle: p.taskCycle,
          taskLastDoneAt:
            p.taskLastDoneAt != null ? new Date(p.taskLastDoneAt) : null,
          keyTail: p.keyTail,
          note: p.note,
          owned: p.owned,
          hidden: p.hidden,
          sortOrder: p.sortOrder,
        };
        const existing = await db
          .select()
          .from(schema.providers)
          .where(eq(schema.providers.name, p.name))
          .limit(1);
        const exProvider = existing[0];
        if (exProvider) {
          await db
            .update(schema.providers)
            .set(values)
            .where(eq(schema.providers.id, exProvider.id));
        } else {
          await db.insert(schema.providers).values(values);
        }
        pCount++;
      }
      // 服务器清单整表替换（恢复语义）
      await db.delete(schema.pumpServers);
      let sCount = 0;
      for (const s of d.pumpServers) {
        sCount++;
        await db.insert(schema.pumpServers).values({
          name: s.name,
          sub: s.sub,
          tags: JSON.stringify(s.tags),
          status: JSON.stringify(s.status),
          freq: s.freq,
          demo: s.demo ? 1 : 0,
          sortOrder: sCount,
        });
      }
      // 自加 Skill 按名 upsert
      let skCount = 0;
      for (const s of d.userSkills) {
        const values = {
          name: s.name,
          desc: s.desc,
          zone: s.zone,
          tab: s.tab,
          sub: s.sub,
          sourceType: s.sourceType,
          sourceUrl: s.sourceUrl,
          sourcePath: s.sourcePath,
          calls: s.calls,
          lastUsed: s.lastUsed != null ? new Date(s.lastUsed) : null,
        };
        const existing = await db
          .select()
          .from(schema.userSkills)
          .where(eq(schema.userSkills.name, s.name))
          .limit(1);
        const exSkill = existing[0];
        if (exSkill) {
          await db
            .update(schema.userSkills)
            .set(values)
            .where(eq(schema.userSkills.id, exSkill.id));
        } else {
          await db.insert(schema.userSkills).values(values);
        }
        skCount++;
      }
      // 自建工作流按 ID upsert
      let wfCount = 0;
      for (const w of d.userWorkflows) {
        const values = {
          id: w.id,
          zone: w.zone,
          tab: w.tab,
          title: w.title,
          purpose: w.purpose,
          appliesTo: w.appliesTo,
          steps: JSON.stringify(w.steps),
          calls: w.calls,
          lastCalledAt:
            w.lastCalledAt != null ? new Date(w.lastCalledAt) : null,
        };
        const existing = await db
          .select()
          .from(schema.userWorkflows)
          .where(eq(schema.userWorkflows.id, w.id))
          .limit(1);
        const exWf = existing[0];
        if (exWf) {
          await db
            .update(schema.userWorkflows)
            .set(values)
            .where(eq(schema.userWorkflows.id, exWf.id));
        } else {
          await db.insert(schema.userWorkflows).values(values);
        }
        wfCount++;
      }
      await setSettingValue(
        ctx,
        "hidden_factory_skills",
        JSON.stringify(d.hiddenFactorySkills),
      );
      if (d.boardMode) await setSettingValue(ctx, "board_mode", d.boardMode);
      ctx.invalidateQueries();
      return {
        ok: true as const,
        providers: pCount,
        pumpServers: sCount,
        userSkills: skCount,
        userWorkflows: wfCount,
      };
    },
  }),
} satisfies ActionsModule;

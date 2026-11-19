import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
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

// ── 全量目录（来源：AIHOT 免费 Token 页 aihot.news/free-tokens，2026-11-15 当日卡片中可入池者，数据由派工方核实后喂入；2026-11-15 按用户拍板删减至 25 家：非 API 调度且无实际用途的工具福利 11 家与产品内羊毛整区 19 家已下架，见 REMOVED_NAMES；其后提效工具补入 MarkItDown / 共享记忆库 / 本地语音三件已装装备；2026-11-15 再补 8 家（API：Groq / Google Gemini API / 智谱 BigModel / Mistral / NVIDIA Build；免费VPS：Google Cloud / Microsoft Azure / AWS）；其后补入已装提效工具 Scrapling；2026-11-17 目录去重（同名重复条目合并为一条）后共 39 家，其中两张为示例专属服务器卡（demoOnly，只在示例状态出现）
// group: api=API 能打水 / tool=工具福利 / compute=免费算力 / efficiency=提效工具
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
  // 用户自己的状态下用的公开版文案（目录原文可能含作者本人的持有状态
  // 口径；新用户还没领，详情里要换成中性说法）
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
  { name: "agent-desktop", nameEn: "agent-desktop", backer: "开源工具", quota: "替你操作电脑里的软件", content: "替你在 Windows 电脑上点软件按钮、切窗口、看截图。重点是能操作那些不能靠输指令控制的软件；已装好，已在电脑上实测通过。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 400 },
  { name: "Agent Reach", nameEn: "Agent Reach", backer: "开源工具", quota: "免登录搜网页、看视频内容", content: "免登录搜读 GitHub、YouTube、B 站、V2EX 和普通网页，找资料、看视频内容更省事。这五个渠道都实测拿到了内容，已装好，可随时用。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 300 },
  { name: "Scrapling", nameEn: "Scrapling", backer: "开源工具", quota: "专啃难抓的网页：指纹抓取、改版自适应", content: "开源网页抓取工具：带浏览器指纹伪装抓页面，网站改版后能靠元素指纹自己重新定位、不用重写抓法。已装好并实测：公开商店站抓取成功、自适应重定位验过；需要真浏览器渲染的活仍走 agent-browser。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 250 },
  { name: "new-api", nameEn: "new-api", backer: "开源项目（AGPL）", quota: "各家模型统一入口、记用量", content: "把各家模型接到一个入口，按优先级调用，失败自动换一家，并记录各家用量。已装好；只需加上“快过期先用”的规则，以后补给泵图再接真实用量。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 200 },
  { name: "Codex", nameEn: "Codex", backer: "OpenAI", quota: "替你写代码、改项目", content: "在本机替你写代码、改项目、检查能否打包运行。已装好，用你亲自登录的 Pro 账号；你定要求、验结果，它负责写。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 150 },
  { name: "MarkItDown", nameEn: "MarkItDown", backer: "微软（开源）", quota: "把 PDF、Word、PPT 转成干净文本喂给 AI", content: "微软开源的文件转换工具，PDF、Word、PPT、Excel 都能一键转成干净的 Markdown 文本，AI 直接就能读。本机已装好并实测转换成功，带 MCP 接口，随叫随用。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 140 },
  { name: "共享记忆库", nameEn: "mcp-memory-service", backer: "开源项目", quota: "给所有 AI 装的共同记忆，学到的事互通", content: "开源的共享记忆服务，装在本机、数据不出门。各个 AI 学到的事存进同一个库，换个 AI 也记得。已装好，存入和语义召回都实测通过。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 130 },
  { name: "本地语音", nameEn: "FunASR + Kokoro", backer: "开源工具", quota: "本机的耳朵和嘴：听写和朗读都在本机", content: "本地语音两件套：FunASR 把语音转成文字，Kokoro 把文字读出声，都在本机跑、不限量。合成→识别闭环已实测逐字对上。", cycle: "长期（已装好，随时调用）", group: "efficiency", sortValue: 120 },
  // ── API 能打水 ──────────────────────────────────────────────
  { name: "火山方舟", nameEn: "Volcano Ark", backer: "字节跳动", quota: "试用各家模型，注册即有", content: "可分别试用平台上的模型，比较哪种适合你的活。每个模型一次性有 50 万 Token（按处理文字量计的额度），注册即有。", cycle: "一次性", group: "api", sortValue: 500000, featuredRank: 2 },
  { name: "Cloudflare Workers AI", nameEn: "Cloudflare Workers AI", backer: "Cloudflare（美国）", quota: "每天可用模型处理任务", content: "可每天调用模型处理任务。每天给 10,000 Neurons（用量单位），约够小模型几百次、70B 级大模型 100 次；UTC 00:00 刷新，不累积。", cycle: "每日（00:00 UTC 刷新，不滚存）", group: "api", sortValue: 10000, valueKind: "daily", featuredRank: 3 },
  { name: "Reducto", nameEn: "Reducto", backer: "Reducto（美国）", quota: "试用工具，具体用途待确认", content: "可用额度试用 Reducto 工具，具体功能原文没写。一次性额度约 1000 credits。", cycle: "一次性", group: "tool", sortValue: 1001 },
  { name: "阿里云新人礼包", nameEn: "", backer: "阿里巴巴", quota: "新人礼包（仅限新用户）", content: "仅限新注册用户的一次性礼包，老号不可用。", cycle: "一次性", group: "api", sortValue: 300 },
  { name: "魔搭社区", nameEn: "ModelScope", backer: "阿里巴巴 / 阿里云", quota: "每天发放点数，用来调用模型", content: "可每天发放点数来调用模型。每天共 250 魔粒（调用点数）：登录得 200，绑定阿里云再得 50；每次约扣 0.5／1／2 魔粒，当天过期，不累积。", cycle: "每日（当天过期，不攒）", group: "api", sortValue: 250, valueKind: "daily", featuredRank: 4 },
  { name: "超算互联网", nameEn: "", backer: "超算互联网", quota: "新用户额度 · 待核实", content: "官方现行新人权益主要是 Token 量包（API 线），服务器/算力券的两笔旧记录未在官网核到，先标待核实；领取需本人实名（可能要人脸验证）。", cycle: "一次性", group: "compute", sortValue: 60 },
  { name: "OpenRouter", nameEn: "OpenRouter", backer: "OpenRouter（美国）", quota: "每天可调用模型", content: "可调用标着 :free 的模型来处理任务。每天 50 次，每分钟 20 次；一次性买过至少 $10 额度后，升到每天 1,000 次。", cycle: "每日", group: "api", sortValue: 50, valueKind: "daily", featuredRank: 5 },
  { name: "百度智能云", nameEn: "", backer: "百度", quota: "用券抵百度智能云费用", content: "可用代金券抵用百度智能云费用，具体适用范围原文没写。一次性给 ¥20 代金券。", cycle: "一次性", group: "api", sortValue: 20, valueKind: "voucher", featuredRank: 8 },
  { name: "硅基流动", nameEn: "SiliconFlow", backer: "硅基流动（国产独立厂商）", quota: "小模型可直接用，新人另有试用额度", content: "可长期调用部分小模型，但调用速度有限制。国内站新用户另有试用额度；小模型调用不计费。", cycle: "长期基础档", group: "api", sortValue: 16, valueKind: "free", featuredRank: 6 },
  { name: "硅基流动新人试用", nameEn: "", backer: "硅基流动", quota: "用新人试用额度试模型", content: "可用新人试用额度试用模型，国内站新用户一次性有试用额度。这张卡已入池，与已点亮的“硅基流动”是同一家、不同卡，原文未说明试用额度能否重复开通。", cycle: "一次性", group: "api", sortValue: 16 },
  { name: "阿里云百炼", nameEn: "", backer: "阿里巴巴", quota: "新用户试用额度（仅限新用户）", content: "新用户试用额度，仅限新用户，老号不可用。", cycle: "一次性", group: "api", sortValue: 7 },
  { name: "超算互联网小额", nameEn: "", backer: "超算互联网", quota: "新用户额度 · 待核实", content: "官方现行新人权益主要是 Token 量包（API 线），服务器/算力券的两笔旧记录未在官网核到，先标待核实；领取需本人实名（可能要人脸验证）。", cycle: "一次性", group: "compute", sortValue: 6 },
  { name: "DeepSeek", nameEn: "DeepSeek", backer: "深度求索", quota: "用试用额度试模型", content: "可用试用额度试用 DeepSeek 模型。一次性试用额度。", cycle: "一次性", group: "api", sortValue: 6, featuredRank: 7 },
  { name: "蚂蚁灵波", nameEn: "", backer: "蚂蚁集团", quota: "可试用，具体功能待确认", content: "可试用蚂蚁灵波，具体能做什么原文没写。这项福利标为长期，未写额度上限。", cycle: "长期", group: "api", sortValue: 1 },
  { name: "阶跃星辰 StepFun", nameEn: "StepFun", backer: "阶跃星辰", quota: "可试用模型", content: "可试用阶跃星辰的模型。这项福利标为长期，未写可用模型名单或额度上限。", cycle: "长期", group: "api", sortValue: 1 },
  { name: "Groq", nameEn: "Groq", backer: "Groq（美国）", quota: "长期基础层，每天 1000 次请求起，免绑卡", content: "可长期调用 Groq 上的开源模型处理任务。每天 1000 次请求起，免绑卡；注册后拿 key 即可调用。", cycle: "长期基础层", group: "api", sortValue: 1000, valueKind: "daily" },
  { name: "Google Gemini API", nameEn: "Google Gemini API", backer: "Google", quota: "Gemini Flash 基础层，Google 号直接调", content: "可用现成的 Google 账号直接调用 Gemini Flash 模型处理任务，走基础层，不用另外注册。", cycle: "长期基础层", group: "api", sortValue: 1 },
  { name: "智谱 BigModel", nameEn: "BigModel", backer: "智谱 AI", quota: "GLM Flash 长期可用，实名后另有试用 tokens", content: "可长期用 GLM Flash 模型处理任务；完成实名后另有试用 tokens。", cycle: "长期", group: "api", sortValue: 20000000 },
  { name: "Mistral", nameEn: "Mistral AI", backer: "Mistral AI（法国）", quota: "全系模型可试用，手机验证即可", content: "可试用 Mistral 全系模型，手机验证一下就能开通。", cycle: "长期", group: "api", sortValue: 1 },
  { name: "NVIDIA Build", nameEn: "NVIDIA Build", backer: "NVIDIA 英伟达", quota: "100 多个模型，新号约 1000 credits", content: "可试用 100 多个模型；新号约送 1000 credits，还能申请到 5000。", cycle: "一次性", group: "api", sortValue: 1000 },


  // ── 工具福利 ────────────────────────────────────────────────
  { name: "GitHub Models", nameEn: "GitHub Models", backer: "微软 / GitHub", quota: "在开发工具里试用模型", content: "可在开发工具中试用模型。这项福利标为长期，原文未写可用模型名单或额度上限。", cycle: "长期", group: "tool", sortValue: 1 },

  // ── 免费算力 ────────────────────────────────────────────────
  { name: "Kaggle", nameEn: "Kaggle", backer: "Google", quota: "借云端显卡批量跑计算", content: "可在云端运行代码，借显卡批量跑计算。每周约 30 小时，配两块 Tesla T4 显卡，周六刷新；会话制，闲置会断、文件不保存。", cycle: "每周（周六刷新）", group: "compute", sortValue: 30, valueKind: "weekly", featuredRank: 1 },
  { name: "甲骨文 Oracle", nameEn: "Oracle Cloud", backer: "Oracle 甲骨文", quota: "长期可用服务器", content: "注册审核较严，被拒后建议冷却一段时间再试。到手就是一台常驻服务器（约 2 核 12G），能长期挂服务。", cycle: "长期可用（Always Free）", group: "compute", sortValue: 100 },
  { name: "GitHub Codespaces", nameEn: "GitHub Codespaces", backer: "GitHub", quota: "每月 60 小时开发机", content: "GitHub 账号自带的云端开发机，每月 120 核时（2 核机约 60 小时），每月刷新。会话制：闲置约 30 分钟自动停，文件保留。", cycle: "每月刷新", group: "compute", sortValue: 90 },
  { name: "Google Colab", nameEn: "Google Colab", backer: "Google", quota: "T4 显卡 · 单次约 12 小时", content: "云端 GPU 笔记本，救急跑批用。单次最长约 12 小时，闲置会断、东西不保存；还没接管，要用时现开。", cycle: "按次（会话制）", group: "compute", sortValue: 24 },
  { name: "Google Cloud", nameEn: "Google Cloud", backer: "Google", quota: "新账号试用额度 + e2-micro 长期可用", content: "新账号有试用额度（有到期日），另有一台 e2-micro 小机器可以长期挂服务。", cycle: "一次性（试用额度有效期以官方为准）+ e2-micro 长期可用", group: "compute", sortValue: 300 },
  { name: "Microsoft Azure", nameEn: "Microsoft Azure", backer: "微软 Microsoft", quota: "新账号试用额度 30 天 + 小 VM 每月 750 小时、可用 12 个月", content: "新账号试用额度先用 30 天，还有一台小 VM 每月 750 小时、可用 12 个月；注册绑卡后可用。", cycle: "一次性（试用额度 / 30 天）+ 12 个月可用 VM", group: "compute", sortValue: 200 },
  { name: "AWS", nameEn: "Amazon Web Services", backer: "亚马逊 AWS", quota: "试用计划额度 + 做任务再得奖励额度", content: "新版试用计划：注册先有额度，再在控制台完成 6 个新手任务再得奖励额度；试用计划 6 个月。开服务器选试用计划支持的机型（如 t4g.small），不要点付费升级。", cycle: "一次性（试用计划 6 个月）", group: "compute", sortValue: 200 },
  { name: "示例云电脑", nameEn: "Example Cloud PC", backer: "示例", quota: "示例数据：一台云电脑", content: "这是一张示例专属卡，只在示例状态下出现，用来演示示例数据与你自己的数据如何区分：当你添置第一件自己的战利品、看板翻转到你自己的状态时，它会随示例清场一起消失，不会混进你的看板。", cycle: "长期", group: "compute", sortValue: 110, demoOnly: true },
  { name: "示例海外服务器", nameEn: "Example VPS", backer: "示例", quota: "示例数据：一台海外小服务器", content: "这是一张示例专属卡，只在示例状态下出现，用来演示示例数据与你自己的数据如何区分：当你添置第一件自己的战利品、看板翻转到你自己的状态时，它会随示例清场一起消失，不会混进你的看板。", cycle: "长期", group: "compute", sortValue: 105, demoOnly: true },
];

// ── 补给泵图服务器层（只存服务端，经动作下发） ──────────────────
// 这排节点不进客户端代码：仅经 getPumpServers 动作下发，且只在看板
// 为本人状态（own）时返回；示例状态返回空数组，客户端改画虚构示例
// 节点。本发布版内置的是虚构示例清单，换成你自己的服务器时改这一处。
const pumpServerShape = z.object({
  name: z.string(),
  sub: z.string(),
  tags: z.array(z.string()),
  status: z.array(
    z.object({
      text: z.string(),
      tone: z.enum(["ok", "due", "warn", "muted"]),
    }),
  ),
});
type PumpServer = z.infer<typeof pumpServerShape>;

const PUMP_SERVERS: PumpServer[] = [
  {
    name: "腾讯云 · 云服务器",
    sub: "云服务器",
    tags: ["业务站点", "数据处理"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
  },
  {
    name: "香港 · 云服务器",
    sub: "云服务器",
    tags: ["应用服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "到期日未登记", tone: "muted" },
    ],
  },
  {
    name: "Kaggle · GPU 算力",
    sub: "每周约 30 小时 T4 x2",
    tags: ["GPU 跑批"],
    status: [
      { text: "可用", tone: "ok" },
      { text: "每周六刷新", tone: "due" },
      { text: "会话制 · 闲置会断", tone: "warn" },
    ],
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
  },
  {
    name: "云电脑（示例）",
    sub: "云电脑 · 示例",
    tags: ["远程桌面"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "限时开放 · 无固定到期日", tone: "due" },
      { text: "闲置可能被平台回收", tone: "warn" },
    ],
  },
  {
    name: "海外云服务器（示例）",
    sub: "海外小服务器 · 示例",
    tags: ["网络出口"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "试用期内", tone: "due" },
      { text: "临时 IP · 重启可能变", tone: "warn" },
    ],
  },
  {
    name: "云服务器（示例）",
    sub: "试用期小服务器 · 示例",
    tags: ["常驻服务"],
    status: [
      { text: "运行中", tone: "ok" },
      { text: "固定 IP", tone: "muted" },
      { text: "试用期内", tone: "due" },
      { text: "期后需绑卡续用", tone: "warn" },
    ],
  },
];

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
]);

const SEED: Array<
  Omit<
    ProviderRow,
    "id" | "createdAt" | "backer" | "groupKey" | "sortValue" | "featuredRank" | "owned"
  >
> = [
  {
    name: "魔搭社区",
    nameEn: "ModelScope",
    quotaText: "每天发放点数，用来调用模型",
    dailyDetail: "可每天发放点数来调用模型。每天共 250 魔粒（调用点数）：登录得 200，绑定阿里云再得 50；每次约扣 0.5／1／2 魔粒，当天过期，不累积。",
    refreshRule: "当天过期，不攒",
    rateLimit: "热门模型会限速，以页面显示为准",
    models: "DeepSeek、MiniMax、Qwen 等开源模型（API-Inference）",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    conditionText: "实名阿里云账号绑定 + 验证邮箱；仅限非商业用途",
    status: "unclaimed",
    keyTail: "",
    note: "",
    taskCycle: "daily",
    taskLastDoneAt: null,
    sortOrder: 1,
  },
  {
    name: "Cloudflare Workers AI",
    nameEn: "Cloudflare Workers AI",
    quotaText: "每天可用模型处理任务",
    dailyDetail: "可每天调用模型处理任务。每天给 10,000 Neurons（用量单位），约够小模型几百次、70B 级大模型 100 次；UTC 00:00 刷新，不累积。",
    refreshRule: "00:00 UTC 刷新，不滚存",
    rateLimit: "基础套餐超额停用，不扣费",
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
    quotaText: "每天可调用模型",
    dailyDetail: "可调用标着 :free 的模型来处理任务。每天 50 次，每分钟 20 次；一次性买过至少 $10 额度后，升到每天 1,000 次。",
    refreshRule: "按天刷新（:free 模型）",
    rateLimit: "20 次/分钟",
    models: ":free 后缀的模型（名单会变）",
    baseUrl: "",
    conditionText: "注册账号即可；每天 50 次",
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
    quotaText: "小模型可直接用，新人另有试用额度",
    dailyDetail: "可长期调用部分小模型，但调用速度有限制。国内站新用户另有试用额度；小模型调用不计费。",
    refreshRule: "可用名单会变，以页面标注为准",
    rateLimit: "基础模型固定限速，不随充值提升",
    models: "Qwen3-8B、Qwen2.5-7B、DeepSeek-R1-Distill-Qwen-7B、DeepSeek-OCR 等不计费模型",
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
    quotaText: "试用各家模型，注册即有",
    dailyDetail: "可分别试用平台上的模型，比较哪种适合你的活。每个模型一次性有 50 万 Token（按处理文字量计的额度），注册即有。",
    refreshRule: "试用额度，以平台规则为准",
    rateLimit: "",
    models: "平台各模型分别有试用额度",
    baseUrl: "",
    conditionText: "注册即有",
    status: "registered",
    keyTail: "",
    note: "",
    taskCycle: "none",
    taskLastDoneAt: null,
    sortOrder: 5,
  },
];

export const Actions = {
  listProviders: defineAction({
    description: "列出 Token 池台账里的全部提供方，按台账顺序排列；同时返回看板状态 boardMode（example＝示例状态，甲板展示的是内置示例数据；own＝用户自己的状态）。",
    request: z.object({}),
    response: z.object({
      providers: z.array(providerShape),
      boardMode: z.enum(["example", "own"]),
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
      };
    },
  }),

  getPumpServers: defineAction({
    description:
      "返回补给泵图上方服务器层的数据：仅当看板为本人状态（own）时返回服务端内置的服务器清单；示例状态返回空数组（客户端改画虚构示例节点，清单不下发）。",
    request: z.object({}),
    response: z.object({
      servers: z.array(pumpServerShape),
    }),
    handler: async (ctx): Promise<{ servers: PumpServer[] }> => {
      const mode = await getBoardMode(ctx);
      return { servers: mode === "own" ? PUMP_SERVERS : [] };
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
      "把全量目录（39 家）同步进台账：先删下架名单里的行（非 API 调度且无实际用途的工具福利与产品内羊毛整区），再按名称去重（同名多行只保留带用户数据最多的一行，其余删除）；缺的按名补入，同名已存在绝不重复插入；已有的只补结构字段（分类/排序值/推荐位，其中排序值按实际可用价值换算：每日刷新×30、每周×30/7、代金券×0.5、免费不限量按附带赠金算）。看板状态决定示例层：示例状态（example）下目录的已点亮状态、示例备注、定期任务种子与示例专属条目（作者本人的服务器卡）一并入账，拼出完整的示例看板；用户自己的状态（own）下只入目录本体——全部未点亮、不带示例备注、文案用公开版、示例专属条目不入账，已有行也不再被示例层触碰。绝不覆盖 key 尾号和用户改过的状态。",
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
        // 用户自己的状态里不插入，已有的（作者本人实例）也原样不动
        if (e.demoOnly && mode !== "example") continue;
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
    description: "更新一家的领取状态、key 尾号、备注及台账字段。示例状态下调用＝用户开始添置自己的战利品：这一行标为用户所有，并自动翻转到用户自己的状态（示例数据清场）。",
    request: z.object({
      id: z.number().int().positive(),
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
    description: "往台账里新增一家提供方（用户自己的战利品）。示例状态下新增＝自动翻转到用户自己的状态（示例数据清场）。",
    request: z.object({
      name: z.string().min(1).max(80),
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
          groupKey: "tool",
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
} satisfies ActionsModule;

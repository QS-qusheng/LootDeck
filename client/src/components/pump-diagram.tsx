/* ── 资源调度图（原名补给泵图，2026-11-20 改名）：React Flow（@xyflow/react，MIT）本体渲染 ──
   形态：三层——最上方一排服务器节点（数据经 getPumpServers 动作从
   用户数据层下发，可增删改；示例状态为虚构示例组），中间居中
   「补给泵 · 网关」节点，下方一排已点亮的水源节点。边从水源向上汇入
   泵，再从泵向上分供服务器。
   分页（2026-11-20 定版，2026-11-20 纠错补规）：顶部两个页签「常用
   资源」（默认）/「不常用资源」——服务器按台账 freq 字段分（驻留/常驻
   ＝常用、会话制/按需＝不常用），水源按近 7 天真实调用分。分页的
   铁规是「无计量 ≠ 未使用」：只有被网关计量过、且近 7 天调用为 0 的
   水源才判不常用；根本不经过网关、没有计量的水源（自有通道、未接
   网关的渠道）不许默认判不常用，按性质归常用页（自有通道是全场
   用量最大的一个，只是它不经这个网关、计量恒为零）。图下
   使用情况跟随当前页签。网关恒居中：泵与整图共用同一条中轴，服务器
   排、水源排都绕中轴对称排布；任一排一排放不下时按均衡分行（行内
   顺序不变、离泵最近的一行是第一行），不硬挤。每台服务器
   标签分工（2026-11-17 定版）：状态标签挂在节点上方（主机状态：绿
   运行中 / 金到期日 / 红注意事项 / 灰未登记，七台全做），业务标签统一
   放在节点下方（水蓝，这台在干的活）。
   水源数据全部来自台账（listProviders），不写死名单外数据：
   只取已点亮且在 PUMP_ORDER 名单内的 6 家，名称/额度文案取台账字段。
   水源从左到右按抽水优先级排列（PUMP_ORDER，序号徽章 1、2、3…）：
   先烧快过期的——魔搭（24h 过期）> Cloudflare（当天作废）> OpenRouter
   （隔日作废）> 硅基流动（常驻零成本）> 硅基流动新人赠金（一次性余额）>
   火山方舟（一次性大额）。序号是挑选优先级，不是独占
   顺序：多任务时可同时抽多家。Kaggle 是上方那台 GPU 服务器，不在水源行重复出现。
   边的粗细按每日量级相对缩放（映射表 PIPE 是展示口径，源自台账额度量级）；
   每日/每周刷新型用 React Flow 的 animated 边（流动虚线），一次性型用静态边。
   网关真实调用优先：台账带 gw* 统计（syncGatewayStats 写入）的渠道若近 7 天
   有调用，边宽改按调用量分档；使用情况不再做图上的浮动标签（沿连线飘着
   对不上号、显乱），改在泵图正下方竖排成清单——按抽水优先级一行一家，
   有真实调用的显「近 7 天 N 次 · M tokens」，暂无真实调用的保留额度文案
   并注明「暂无调用」。
   居中适配：节点坐标是按全宽画布排的固定值，fitView 只在挂载时算一次——
   壳层先窄后宽、旋转屏幕、窗口改尺寸都会让初次 fit 的缩放/偏移过期，整图
   靠左、1 号节点被裁。故容器宽度一变（ResizeObserver）就重新 fitView 居中；
   minZoom 放到 0.2，窄屏能把整排缩进画面完整居中。图面为只读展示：禁止
   手动平移/拖拽，始终保持 fitView 的最佳居中状态。
   窄屏紧凑布局（2026-11-17 修）：容器宽 <720px 时服务器/水源改多行竖排
   （服务器每行 2 台、水源每行 3 家），图变窄变高、fitView 缩放从约 0.19
   升到约 0.6，标题回到可读量级；容器高度按图面纯宽高比折算，不再固定
   574px 在图面上下留大片空白；ResizeObserver 对宽、高任一变化都防抖
   重 fit——只盯宽度时，高度落位那一步会被漏掉、fit 停在挂载初期的
   临时视图上（缩放夹到 minZoom、图钉在面板顶部约四成处，2026-11-17
   导出复核实证后修）；双指捏合缩放开放（zoomOnPinch），细字可
   捏合放大看清，一指拖动归页面滚动——注意光靠 panOnDrag 关并不够：
   xyflow 样式表给 .react-flow__pane 写死了 touch-action: none，图上
   任何位置起手的滑动都会被浏览器判给 JS、页面滚不动（实测致命问题）；
   真正的放行是 theme.css 里对泵图 pane 的 touch-action: pan-y 覆盖，
   删那条规则此问题立刻复发。紧凑版不画水柱柱体层，免得粗柱压过
   中间行的节点。 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
Background,
BackgroundVariant,
Position,
ReactFlow,
type Edge,
type Node,
type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { api, ApiResponse } from "../api";
import { DECK_ICON_PATHS } from "../assets/deck-icon-paths";

type Provider = ApiResponse<typeof api, "listProviders">["providers"][number];

// 已点亮水源的展示顺序（左→右）与管线口径：label 量级文案、相对粗细、是否流动。
// label 缺省回落到台账 quotaText；一次性型 animated=false 并在标签注明「一次性」。
const PIPE: Record<
  string,
  { label?: string; width: number; animated: boolean }
> = {
  "Cloudflare Workers AI": { label: "10,000 Neurons/天", width: 5, animated: true },
  魔搭社区: { label: "250 魔粒/天", width: 3.5, animated: true },
  OpenRouter: { label: "50 次/天", width: 2.5, animated: true },
  硅基流动: { label: "小模型 ¥0 调用", width: 2, animated: true },
  硅基流动新人赠金: { label: "¥16 赠金 · 一次性", width: 1.5, animated: false },
  火山方舟: { label: "50 万 Token · 一次性", width: 4, animated: false },
};
// 自有通道槽位（图内固定水源，不在台账里）：通用槽位、不写死任何具体
// 名字——显示名与头像运行时从用户数据层取（getSelfIdentity：用户自己的
// Muse 的名字/头像），取不到回落「我的 Muse」＋通用图标。它不经过
// 网关、没有调用统计，使用情况照实写「不经网关计量，实际用量最大」，
// 不编数字；分页恒归常用页（无计量 ≠ 未使用）。
const SELF_PIPE = { label: "自有通道", width: 2, animated: true };
// 网关真实调用：有近 7 天调用的渠道，边宽按调用量分档、标签显真实数；
// 暂无真实调用（gwCalls7d 为空或 0，含未接网关的火山方舟/硅基流动新人赠金）
// 保留原额度标签并在标签后加「（暂无调用）」。
function callsToWidth(calls: number): number {
  if (calls >= 1000) return 6;
  if (calls >= 300) return 5;
  if (calls >= 100) return 4;
  if (calls >= 30) return 3;
  if (calls >= 10) return 2.5;
  return 2;
}

function formatTokens(n: number): string {
  if (n >= 10000) {
    const v = n / 10000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)} 万`;
  }
  return n.toLocaleString("en-US");
}

// 抽水优先级默认序（左→右，序号 1 起）：先烧快过期的。用户拖动改序后
// 以用户层顺序为准，此表只作默认与在场判定
export const PUMP_ORDER = [
  "魔搭社区",
  "Cloudflare Workers AI",
  "OpenRouter",
  "硅基流动",
  "硅基流动新人赠金",
  "火山方舟",
];

type ServerStatusTone = "ok" | "due" | "warn" | "muted";
export type PumpServer = {
  id: number;
  name: string;
  sub: string;
  tags: string[];
  status: Array<{ text: string; tone: ServerStatusTone }>;
  /** hot=常用资源页 / cold=不常用资源页（台账字段，服务器管理里可改） */
  freq: "hot" | "cold";
  demo: boolean;
};

// 服务器层数据口径：服务器清单存用户数据层（pump_servers 表），经
// getPumpServers 动作下发（行带 id/freq/demo），页面可增删改；客户端
// 不再内置任何服务器清单。示例状态下发的是服务端播种的虚构示例组
// （demo=true），图头挂「示例」标。
// 状态语义色（只用在面板内每行行首的小圆点上，面板底色统一半透明白、
// 文字统一深灰蓝，克制用色、不再一台一堆彩色胶囊）：
// ok 绿 / due 金 / warn 红 / muted 灰
const STATUS_DOT: Record<ServerStatusTone, string> = {
  ok: "#059669",
  due: "#d9a521",
  warn: "#e11d48",
  muted: "#94a3b8",
};

// 这 6 家的品牌色块（与卡墙 BRAND 同色值，识别用）
const PUMP_BRAND: Record<string, { bg: string; mark: string }> = {
  魔搭社区: { bg: "#4f46e5", mark: "魔" },
  "Cloudflare Workers AI": { bg: "#f6821f", mark: "Cf" },
  OpenRouter: { bg: "#475569", mark: "OR" },
  硅基流动: { bg: "#0e7490", mark: "硅" },
  硅基流动新人赠金: { bg: "#0e7490", mark: "赠" },
  火山方舟: { bg: "#325ab4", mark: "火" },
};

/** 图内水源的统一形状：台账水源（已点亮的 PUMP_ORDER 各家）＋一枚固定
    的自有通道槽位（self=true）。槽位是通用机制：名字与头像运行时取
    用户自己的 Muse 身份（getSelfIdentity），不在台账、无调用统计、
    不经网关计量。出厂数据里只有槽位机制与中性回落（「我的 Muse」＋
    通用图标），不写死任何具体名字。 */
type Src = {
  key: string;
  name: string;
  usageName?: string;
  quotaText: string;
  gwCalls7d: number | null;
  gwTokens7d: number | null;
  self?: boolean;
};

const SELF_SOURCE: Src = {
  key: "self",
  self: true,
  name: "",
  quotaText: "自有通道",
  gwCalls7d: null,
  gwTokens7d: null,
};

function isLit(p: Provider): boolean {
  return p.status === "claimed" || p.status === "pooled" || p.status === "registered";
}

// 甲板主题水柱：边的柱体层 stroke 引用的竖向水蓝渐变（浅→深、自上而下）。
// defs 由组件在开主题时渲染进面板（隐藏 svg），id 全页唯一。
const WATER_GRAD_ID = "deck-water-grad";
const WATER_STROKE = `url(#${WATER_GRAD_ID})`;

// 甲板主题云朵：云形直接采用 Font Awesome Free 的 cloud 图标轮廓（Fonticons,
// Inc.；Icons: CC BY 4.0，https://fontawesome.com/license/free），路径逐字取自
// @fortawesome/fontawesome-free 6.5.2 的 svgs/solid/cloud.svg 原文件、未改
// 轮廓；只按甲板主题改填充（白面）、描边（水蓝）与尺寸（拉伸铺满节点）。
// 选型实测（2026-11-17）：三款成熟云形（本款 / Material Design Icons cloud /
// Ionicons cloud）同尺寸拉伸成宽云后逐像素比对轮廓内可容纳的居中文字区，
// 本款最宽（248×84 时约 179px），标题＋副标题两行能完整落在轮廓内、
// 四周留白均匀；节点内容再整体下沉/右移 4px，避开左上肩线。
const CLOUD_PATH =
  "M0 336c0 79.5 64.5 144 144 144H512c70.7 0 128-57.3 128-128c0-61.9-44-113.6-102.4-125.4c4.1-10.7 6.4-22.4 6.4-34.6c0-53-43-96-96-96c-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32C167.6 32 96 103.6 96 192c0 2.7 .1 5.4 .2 8.1C40.2 219.8 0 273.2 0 336z";

const NODE_W = 156;
const GAP = 30;

export function PumpDiagram({
  providers,
  servers: serversProp,
  deck = false,
  isExample = false,
  serversDemo = false,
  selfIdentity,
  sourceOrder,
  onManage,
  onReorderServers,
  onReorderSources,
}: {
  providers: Provider[];
  // 服务器清单（getPumpServers 从用户数据层下发，未加载完为空）
  servers?: PumpServer[];
  // 甲板主题（清新版）：仅换皮——面板改海水渐变 + 底部两层平铺浪花、
  // 连线改水柱（宽幅半透明水蓝渐变柱体 + 虚线流光，柱宽即流量分档）、
  // 顶部服务器节点改云朵形容器、水源节点小幅硬阴影浮标感、网关节点加
  // 船舵标、浅色模式；节点、数据、布局坐标与关闭时完全一致
  deck?: boolean;
  // 示例状态：图头挂「示例」标，免得被当成用户自己的服务器
  isExample?: boolean;
  // 当前服务器整组仍是虚构示例组（own 态回落时）：图头同样挂示例标
  serversDemo?: boolean;
  // 自有通道槽位的运行时身份（用户自己的 Muse 的名字/头像，来自用户
  // 数据层 getSelfIdentity）；取不到时槽位回落「我的 Muse」＋通用图标
  selfIdentity?: { name: string | null; avatarUrl: string | null };
  // 水源排用户自定义顺序（settings 里的名字数组，自有通道记 __self__）；
  // 空/未设置时按出厂默认序 PUMP_ORDER
  sourceOrder?: string[];
  // 标题行「管理」就地入口：打开图下同一套管理面板（服务器＋水源双排）
  onManage?: () => void;
  // 拖动落位回调：服务器排新顺序（全部服务器 id）/ 水源排新顺序（名字
  // 数组，自有通道记 __self__），由页面落库到用户数据层
  onReorderServers?: (ids: number[]) => void;
  onReorderSources?: (names: string[]) => void;
}) {
  // 台账水源：已点亮且在册的水源——出厂默认名单（PUMP_ORDER）＋用户在
  // 管理面板里加进图的水源（名字进了用户层顺序表）；名称/额度文案取台账
  const realSources = useMemo<Src[]>(
    () =>
      [...new Set([...PUMP_ORDER, ...(sourceOrder ?? [])])]
        .map((name) => providers.find((p) => p.name === name))
        .filter((p): p is Provider => p != null && isLit(p))
        .map((p) => ({
          key: `p${p.id}`,
          name: p.name,
          quotaText: p.quotaText,
          gwCalls7d: p.gwCalls7d,
          gwTokens7d: p.gwTokens7d,
        })),
    [providers, sourceOrder],
  );
  // 自有通道槽位：名字/头像运行时取用户自己的 Muse 身份，取不到回落
  // 中性占位（「我的 Muse」＋通用图标）——出厂代码不写死任何具体名字
  const selfName = selfIdentity?.name?.trim() || "我的 Muse";
  const selfAvatarUrl = selfIdentity?.avatarUrl ?? null;
  // 全部水源＝台账水源＋自有通道槽位。左右顺序＝抽水优先顺序：用户拖动
  // 过的按用户层顺序（sourceOrder，槽位记 __self__），否则按出厂默认序
  // （PUMP_ORDER 先烧快过期，槽位排最后）。顺序只含当前在场水源，缺位
  // 的按默认序补到末尾——图与图下使用情况表共用这份顺序，序号恒一致。
  const allSources = useMemo<Src[]>(() => {
    const self: Src = {
      ...SELF_SOURCE,
      name: selfName,
      usageName: `${selfName} · 自有通道`,
    };
    const pool = [...realSources, self];
    const keyOf = (s: Src) => (s.self ? "__self__" : s.name);
    const defaultIdx = (s: Src) =>
      s.self ? PUMP_ORDER.length : PUMP_ORDER.indexOf(s.name);
    const custom = sourceOrder ?? [];
    const hasCustom = custom.length > 0;
    return pool.sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      const ia = hasCustom ? custom.indexOf(ka) : -1;
      const ib = hasCustom ? custom.indexOf(kb) : -1;
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return defaultIdx(a) - defaultIdx(b);
    });
  }, [realSources, selfName, sourceOrder]);

  const servers = serversProp ?? [];
  const layerOn = servers.length > 0;

  // ── 分页（常用 / 不常用） ────────────────────────────────────────
  // 铁规「无计量 ≠ 未使用」：gwCalls7d 为 null＝没有网关统计行（不经
  // 网关/未接网关——自有通道恒属此类，它走平台自身供能、计量恒为零，
  // 实际却是全场用量最大）→ 按性质归常用页；有统计行且近 7 天调用
  // >0 的也是常用；只有被计量过且近 7 天为 0 次的才判不常用。
  // 服务器按台账 freq 分。页内顺序不变（左→右＝优先顺序）。
  const isHotSource = (s: Src) => s.gwCalls7d == null || s.gwCalls7d > 0;
  const srcHot = allSources.filter(isHotSource);
  const srcCold = allSources.filter((s) => !isHotSource(s));
  const pages = {
    hot: {
      servers: servers.filter((s) => s.freq !== "cold"),
      sources: srcHot,
    },
    cold: {
      servers: servers.filter((s) => s.freq === "cold"),
      sources: srcCold,
    },
  };
  const coldCount = pages.cold.servers.length + pages.cold.sources.length;
  const showTabs = coldCount > 0;
  const [page, setPage] = useState<"hot" | "cold">("hot");
  const activePage = page === "cold" && coldCount === 0 ? "hot" : page;
  const pageServers = pages[activePage].servers;
  const pageSources = pages[activePage].sources;

  // 容器实测宽度（下方 ResizeObserver 回填）：决定宽/紧凑布局与容器高度。
  // <720px 走紧凑布局：整排硬塞窄屏时 fitView 缩放只有约 0.19，字小到
  // 看不清（2026-11-17 用户反馈），改多行竖排把缩放抬回约 0.6。
  const [boxWidth, setBoxWidth] = useState(0);
  const compact = boxWidth > 0 && boxWidth < 720;

  const { nodes, edges, bounds } = useMemo(() => {
    const pumpW = 224;
    // 服务器节点宽 248、间距 10；248×84 的云形（Font Awesome cloud
    // 轮廓）经实测能把最长的标题＋副标题两行完整包住、互不重叠。
    const srvW = 248;
    const srvGap = 10;
    // ── 分行与居中（定版） ────────────────────────────────────────
    // 任一排一排放不下（按容器宽折算每行上限）时均衡分行：行数=
    // ceil(总数/上限)，每行个数尽量均分；行内顺序不变（左→右＝优先
    // 顺序），sizes[0] 是离泵最近的一行（服务器在泵上方→最底行、
    // 水源在泵下方→最顶行）。所有行与泵共用同一条中轴（contentW/2）：
    // 网关恒居中、两侧连线对称汇入，不再按某一排的宽度偏移泵位。
    const srvCap = compact
      ? 2
      : boxWidth === 0 || boxWidth >= 1250
        ? Number.POSITIVE_INFINITY
        : boxWidth >= 860
          ? 4
          : 3;
    const srcCap = compact
      ? 3
      : boxWidth === 0 || boxWidth >= 1250
        ? Number.POSITIVE_INFINITY
        : boxWidth >= 860
          ? 5
          : 4;
    const splitRows = (count: number, cap: number): number[] => {
      if (count === 0) return [];
      const rows = Math.max(1, Math.ceil(count / cap));
      const base = Math.floor(count / rows);
      const rem = count % rows;
      return Array.from({ length: rows }, (_, r) => base + (r < rem ? 1 : 0));
    };
    const locate = (
      sizes: number[],
      i: number,
    ): { row: number; col: number } => {
      let acc = 0;
      for (let r = 0; r < sizes.length; r++) {
        const k = sizes[r] ?? 0;
        if (i < acc + k) return { row: r, col: i - acc };
        acc += k;
      }
      return { row: Math.max(0, sizes.length - 1), col: 0 };
    };
    const srvSizes = layerOn ? splitRows(pageServers.length, srvCap) : [];
    const srcSizes = splitRows(pageSources.length, srcCap);
    const widestRow = (sizes: number[], w: number, gap: number): number =>
      sizes.reduce((m, k) => Math.max(m, k * w + Math.max(0, k - 1) * gap), 0);
    const contentW = Math.max(
      widestRow(srvSizes, srvW, srvGap),
      widestRow(srcSizes, NODE_W, GAP),
      pumpW,
    );
    const centerX = contentW / 2;
    const SRV_PITCH_Y = 268; // 服务器节点最高约 255（状态面板+云+3 枚业务标签）
    const SRC_PITCH_Y = 72;
    const srvRows = srvSizes.length;
    const srcRows = srcSizes.length;
    // 网关居中：泵中心＝整图中心
    const pumpX = centerX - pumpW / 2;
    const pumpY = layerOn ? srvRows * SRV_PITCH_Y - 6 : 8;
    const srcY0 = pumpY + (compact ? 100 : 208);
    const contentH =
      srcRows > 0
        ? srcY0 + (srcRows - 1) * SRC_PITCH_Y + 58
        : pumpY + 118;
    const srvPos = (i: number): { x: number; y: number } => {
      const { row, col } = locate(srvSizes, i);
      const k = srvSizes[row] ?? 0;
      const w = k * srvW + Math.max(0, k - 1) * srvGap;
      return {
        x: centerX - w / 2 + col * (srvW + srvGap),
        // sizes[0] 离泵最近＝最底行，故行序上下翻转
        y: (srvRows - 1 - row) * SRV_PITCH_Y,
      };
    };
    const srcPos = (i: number): { x: number; y: number } => {
      const { row, col } = locate(srcSizes, i);
      const k = srcSizes[row] ?? 0;
      const w = k * NODE_W + Math.max(0, k - 1) * GAP;
      return {
        x: centerX - w / 2 + col * (NODE_W + GAP),
        y: srcY0 + row * SRC_PITCH_Y,
      };
    };
    const ns: Node[] = !layerOn
      ? []
      : pageServers.map((s, i) => ({
      id: `srv-${s.id}`,
      type: "output" as const,
      targetPosition: Position.Bottom,
      position: srvPos(i),
      // 可拖动调序：左右顺序＝优先顺序，拖完由页面落库（用户数据层）
      draggable: true,
      selectable: false,
      data: {
        label: (
          <span style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* 状态面板：挂在节点上方（定版：上面是主机状态、
                下面统一是做什么）。一台一块统一面板（半透明白底 + 细边），
                不再是零散小胶囊：面板固定高 88px、满宽，七台顶边与底边
                齐平，整排读成一条完整的带。内部自上而下：第一行主状态
                （加粗），其下到期日/注意事项为灰字小行；语义色只落在
                每行行首的小圆点上。面板底与云朵贴合（marginBottom 6），
                节点总高与旧版式一致，坐标与连线不动 */}
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 2,
                height: 88,
                marginBottom: 6,
                width: "100%",
                boxSizing: "border-box",
                padding: "7px 6px 6px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.92)",
                border: "1px solid rgba(124, 195, 232, 0.55)",
                boxShadow: "0 1px 4px rgba(34, 102, 148, 0.14)",
              }}
            >
              {s.status.map((t, idx) => (
                <span
                  key={t.text}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    ...(idx === 0
                      ? {
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: "17px",
                          color: "#20394a",
                        }
                      : {
                          fontSize: 10,
                          fontWeight: 500,
                          lineHeight: "15px",
                          color: "#4b6070",
                        }),
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: idx === 0 ? 6 : 5,
                      height: idx === 0 ? 6 : 5,
                      borderRadius: 9999,
                      background: STATUS_DOT[t.tone],
                      flexShrink: 0,
                    }}
                  />
                  {t.text}
                </span>
              ))}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                width: "100%",
                boxSizing: "border-box",
                ...(deck
                  ? {
                      position: "relative",
                      height: 84,
                      // 内容整体下沉/右移约 4px：避开云形左上肩线，
                      // 两行文字落在轮廓安全区正中
                      padding: "8px 0 0 8px",
                      filter: "drop-shadow(0 3px 6px rgba(34, 102, 148, 0.15))",
                    }
                  : {
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "8px 10px",
                    }),
              }}
            >
              {deck ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 640 512"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <path
                    d={CLOUD_PATH}
                    fill="#ffffff"
                    stroke="#7cc3e8"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : null}
              <span
                aria-hidden="true"
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: "#334155",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <rect x="3" y="4" width="18" height="7" rx="2" />
                  <rect x="3" y="13" width="18" height="7" rx="2" />
                  <path d="M6.5 7.5h.01M6.5 16.5h.01" strokeWidth="2.6" />
                </svg>
              </span>
              <span style={{ position: "relative", textAlign: "left", minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.sub}
                </span>
              </span>
            </span>
            {/* 业务标签：直接放在服务器正下方，一行一个、竖着排（不在云朵里横排挤） */}
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                width: "100%",
              }}
            >
              {s.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    padding: "1px 8px",
                    borderRadius: 9999,
                    background: "rgba(255, 255, 255, 0.88)",
                    border: "1px solid rgba(18, 147, 204, 0.35)",
                    color: "#0b6ea8",
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 3px rgba(34, 102, 148, 0.12)",
                  }}
                >
                  {t}
                </span>
              ))}
            </span>
          </span>
        ),
      },
      style: {
        width: srvW,
        border: "none",
        background: "transparent",
        color: "var(--text)",
        padding: 0,
        boxShadow: "none",
      },
    }));
    ns.push({
        id: "pump",
        type: "default",
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        position: { x: pumpX, y: pumpY },
        draggable: false,
        selectable: false,
        data: {
          label: deck ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <svg
                viewBox="0 0 512 512"
                width="26"
                height="26"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d={DECK_ICON_PATHS.shipWheel} fill="#3d2c00" />
              </svg>
              <span style={{ textAlign: "left" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  补给泵 · 网关
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    opacity: 0.85,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  统一接口 · 从各家水源抽水
                </span>
              </span>
            </span>
          ) : (
            <span style={{ display: "block", textAlign: "center" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 15,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                补给泵 · 网关
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  opacity: 0.85,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                统一接口 · 从各家水源抽水
              </span>
            </span>
          ),
        },
        style: {
          width: pumpW,
          borderRadius: 14,
          border: "1.5px solid #d9a521",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 55%), linear-gradient(90deg, #d9a521, #f0a832 55%, #ef7d4a)",
          color: "#3d2c00",
          boxShadow: "0 0 12px rgba(217, 165, 33, 0.55)",
          padding: "10px 12px",
          // 甲板主题：晴黄泵体 + 一层小幅偏移硬阴影（与全页降噪口径一致）
          ...(deck
            ? {
                borderRadius: 18,
                border: "2px solid #d9a521",
                boxShadow:
                  "2px 2px 0 rgba(146, 104, 6, 0.35), 0 0 12px rgba(242, 183, 5, 0.45)",
              }
            : {}),
        },
      });
    // 网关向上分供七台服务器（水抽上来给它们用）。
    // 甲板主题：每条连线先垫一层宽幅半透明水蓝渐变「柱体」（水柱本体，
    // 先入数组＝渲染在下层），再叠原 animated 虚线作柱面流光；柱宽即流量。
    const es: Edge[] = [];
    if (layerOn) pageServers.forEach((s) => {
      // 紧凑版不垫水柱：多行排布下粗柱会压过中间行的节点，只留流光线
      if (deck && !compact) {
        es.push({
          id: `srv-edge-bg-${s.id}`,
          source: "pump",
          target: `srv-${s.id}`,
          animated: false,
          style: { stroke: WATER_STROKE, strokeWidth: 10, opacity: 0.85 },
        });
      }
      es.push({
        id: `srv-edge-${s.id}`,
        source: "pump",
        target: `srv-${s.id}`,
        animated: true,
        style: {
          stroke: deck ? "#1293cc" : "var(--accent)",
          strokeWidth: 2.5,
          opacity: 0.9,
        },
      });
    });
    pageSources.forEach((p, i) => {
      const cfg = p.self ? SELF_PIPE : (PIPE[p.name] ?? { width: 2, animated: false });
      const brand = PUMP_BRAND[p.name] ?? { bg: "#0d5c4d", mark: "·" };
      ns.push({
        id: `src-${p.key}`,
        type: "input",
        sourcePosition: Position.Top,
        position: srcPos(i),
        // 可拖动调序：左右顺序＝抽水优先顺序，拖完由页面落库（用户层）
        draggable: true,
        selectable: false,
        data: {
          label: (
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <span
                aria-label={`抽水优先级 ${i + 1}`}
                title={`抽水优先级 ${i + 1}`}
                style={{
                  position: "absolute",
                  top: -17,
                  left: -17,
                  zIndex: 3,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 9999,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 55%), linear-gradient(90deg, #d9a521, #f0a832 55%, #ef7d4a)",
                  color: "#3d2c00",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1,
                  border: "1.5px solid #fff",
                  boxShadow: "0 1px 5px rgba(35, 40, 56, 0.35)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              {p.self && selfAvatarUrl ? (
                <img
                  src={selfAvatarUrl}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : p.self ? (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: "#0f766e",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" fill="#fff" stroke="none" />
                    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
                  </svg>
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: brand.bg,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {brand.mark}
                </span>
              )}
              <span style={{ textAlign: "left", minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.25,
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 96,
                  }}
                >
                  {p.quotaText || "额度待填"}
                </span>
              </span>
            </span>
          ),
        },
        style: {
          width: NODE_W,
          borderRadius: 12,
          border: "1px solid var(--caught-border)",
          background: "var(--caught-bg)",
          color: "var(--text)",
          padding: "8px 10px",
          // 甲板主题：水源像浮在水面的小岛/浮标（厚金边 + 一层小幅偏移硬阴影）
          ...(deck
            ? {
                borderRadius: 16,
                border: "2px solid #f2b705",
                boxShadow: "2px 2px 0 rgba(34, 102, 148, 0.28)",
              }
            : {}),
        },
      });
      // 边宽仍按网关真实调用分档：有近 7 天调用按调用量，暂无调用按额度
      // 口径（粗细/流动不变）。使用情况文字不再挂在边上，统一到图下清单。
      const hasReal = p.gwCalls7d != null && p.gwCalls7d > 0;
      const edgeWidth = hasReal ? callsToWidth(p.gwCalls7d ?? 0) : cfg.width;
      // 甲板主题：先垫水柱柱体层——宽幅半透明水蓝渐变，柱宽按同一流量
      // 分档放大（edgeWidth×2.6+3），柱宽即流量；一次性型柱体更淡。
      // 紧凑版同服务器边：不垫柱体，免得压过中间行的水源节点
      if (deck && !compact) {
        es.push({
          id: `pipe-bg-${p.key}`,
          source: `src-${p.key}`,
          target: "pump",
          animated: false,
          style: {
            stroke: WATER_STROKE,
            strokeWidth: edgeWidth * 2.6 + 3,
            opacity: cfg.animated ? 0.85 : 0.45,
          },
        });
      }
      es.push({
        id: `pipe-${p.key}`,
        source: `src-${p.key}`,
        target: "pump",
        animated: cfg.animated,
        style: {
          // 甲板主题：柱面流光线（流动型深水蓝虚线、一次性型浅水蓝细线），
          // 粗细/流动口径不变
          stroke: deck
            ? cfg.animated
              ? "#1293cc"
              : "#8fb6c6"
            : cfg.animated
              ? "var(--accent)"
              : "var(--text-muted)",
          strokeWidth: edgeWidth,
          opacity: cfg.animated ? 0.9 : 0.55,
        },
      });
    });
    return { nodes: ns, edges: es, bounds: { w: contentW, h: contentH } };
  }, [pageSources, deck, layerOn, pageServers, compact, boxWidth, selfAvatarUrl]);

  // ── 拖动调序（左右顺序＝优先顺序） ────────────────────────────────
  // 拖动中只跟手移动被拖的那一个（dragPos 覆盖其坐标，其余节点不动）；
  // 松手时按落点与同排节点的行序（先行后列）算出新顺序，经回调落库到
  // 用户数据层，数据回来后布局重算、节点带过渡落位。图下使用情况表与
  // 图共用同一份顺序（pageSources/allSources），序号恒同步。
  const [dragPos, setDragPos] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const flowNodes = useMemo(
    () =>
      dragPos
        ? nodes.map((n) =>
            n.id === dragPos.id
              ? { ...n, position: { x: dragPos.x, y: dragPos.y } }
              : n,
          )
        : nodes,
    [nodes, dragPos],
  );
  const handleNodeDragStop = (_e: unknown, dragged: Node) => {
    setDragPos(null);
    const posOf = (n: Node) => (n.id === dragged.id ? dragged.position : n.position);
    const rowMajor = (a: Node, b: Node) => {
      const pa = posOf(a);
      const pb = posOf(b);
      const ra = Math.round(pa.y / 60);
      const rb = Math.round(pb.y / 60);
      return ra !== rb ? ra - rb : pa.x - pb.x;
    };
    if (dragged.id.startsWith("srv-")) {
      const pageIds = pageServers.map((s) => s.id);
      const sorted = nodes
        .filter((n) => n.id.startsWith("srv-"))
        .sort(rowMajor)
        .map((n) => Number(n.id.slice(4)));
      if (sorted.join(",") === pageIds.join(",")) return;
      const all = servers.map((s) => s.id);
      const rest = all.filter((id) => !pageIds.includes(id));
      const at = Math.max(
        0,
        all.findIndex((id) => pageIds.includes(id)),
      );
      const insertAt = Math.min(at, rest.length);
      onReorderServers?.([
        ...rest.slice(0, insertAt),
        ...sorted,
        ...rest.slice(insertAt),
      ]);
    } else if (dragged.id.startsWith("src-")) {
      const keyOf = (s: Src) => (s.self ? "__self__" : s.name);
      const pageKeys = pageSources.map(keyOf);
      const byNodeId = new Map(pageSources.map((s) => [`src-${s.key}`, keyOf(s)]));
      const sorted = nodes
        .filter((n) => n.id.startsWith("src-"))
        .sort(rowMajor)
        .map((n) => byNodeId.get(n.id))
        .filter((k): k is string => k != null);
      if (sorted.join(",") === pageKeys.join(",")) return;
      const all = allSources.map(keyOf);
      const rest = all.filter((k) => !pageKeys.includes(k));
      const at = Math.max(
        0,
        all.findIndex((k) => pageKeys.includes(k)),
      );
      const insertAt = Math.min(at, rest.length);
      onReorderSources?.([
        ...rest.slice(0, insertAt),
        ...sorted,
        ...rest.slice(insertAt),
      ]);
    }
  };

  // ── 居中适配：容器宽度变化 / 水源增减后重新 fitView ──────────────────
  const flowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  const fit = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.12, maxZoom: 1, duration: 200 });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let timer: number | undefined;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const widthChanged = Math.abs(rect.width - lastWidthRef.current) >= 2;
      const heightChanged = Math.abs(rect.height - lastHeightRef.current) >= 2;
      if (!widthChanged && !heightChanged) return;
      if (widthChanged) {
        lastWidthRef.current = rect.width;
        setBoxWidth(rect.width);
      }
      lastHeightRef.current = rect.height;
      // 宽或高任一变化都要重 fit：容器高度是按 boxWidth 折算出来的，
      // 「宽度已定、高度随后才落位」这一步只改高不改宽——旧版只盯宽度，
      // 这次高度变化被整个漏掉，fit 永远停在挂载初期（宽版布局 + 临时
      // 高度）算出的视图上：缩放被夹到 minZoom、图钉在顶部、下方留出
      // 大片空白（2026-11-17 导出复核实证）。防抖 150ms 也让 React Flow
      // 自身的尺寸同步先落位，fit 读到的就是最终容器尺寸。
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
    // allSources.length 入 deps：容器 div 只在有水源时才渲染，出现后要补挂观察
  }, [fit, allSources.length]);

  // 水源点亮/熄灭导致节点排布变化时也重新居中
  useEffect(() => {
    fit();
  }, [fit, nodes]);

  // 还没有任何已点亮水源、也没有服务器：整图不画，给一块空状态面板
  // （新用户自己的看板初始就是这样——空白是预期，不是坏了）
  if (realSources.length === 0 && servers.length === 0) {
    return (
      <section
        aria-label="资源调度图"
        className={`deck-panel overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] ${
          deck ? "relative" : ""
        }`}
      >
        <div className="px-4 py-5">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
              资源调度图
              {isExample || serversDemo ? (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  示例
                </span>
              ) : null}
            </h2>
            {onManage ? (
              <button
                type="button"
                onClick={onManage}
                aria-label="管理资源调度图（服务器与水源）"
                className="ml-auto min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
              >
                管理
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--dim)]">
            还没有点亮的 API。点亮下面任意一家，它就会作为水源出现在这里。
          </p>
        </div>
      </section>
    );
  }

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 容器高度按图面宽高比折算：高度跟着缩放后的实际内容走，图面上下不再
  // 留大片空白（旧版固定 574px，手机上内容只有约 110px 高、其余全是空
  // 蓝面）。宽版另按旧高度封顶，桌面只会更紧凑、不会更高。
  // 紧凑版用纯宽高比（不加边距修正量）：fitView 的 padding 0.12 是按
  // 容器宽高各扣 24% 的比例量，H/W 与 bounds.h/bounds.w 严格相等时
  // 横竖两个方向的缩放恰好一致，图面四边只剩 padding 边距、不留空白
  // 带；旧公式给宽高各加固定修正量（+32/+48），在窄屏上把比例拉偏，
  // 高度比图面所需多出一截（且与最终 fit 的竞态叠加后表现为图只占
  // 面板上部约四成）。宽版保留旧公式与封顶，桌面渲染逐像素不变。
  const diagramH =
    boxWidth > 0
      ? Math.max(
          240,
          compact
            ? Math.round((boxWidth * bounds.h) / bounds.w)
            : Math.round((boxWidth * (bounds.h + 48)) / (bounds.w + 32)),
        )
      : layerOn
        ? 574
        : 322;
  const boxHeight = compact
    ? diagramH
    : Math.min(layerOn ? 574 : 322, diagramH);

  return (
    <section
      aria-label="资源调度图"
      className={`deck-panel overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] ${
        deck ? "deck-aqua relative" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-1 pt-3">
        <h2 className="flex shrink-0 items-center gap-2 text-base font-semibold text-[var(--text)]">
          资源调度图
          {isExample || serversDemo ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
              示例
            </span>
          ) : null}
        </h2>
        <span className="text-xs text-[var(--dim)]">从左到右 = 优先顺序（可拖动调序）</span>
        {showTabs ? (
          <div className="pump-tabs" role="tablist" aria-label="资源分页">
            <button
              type="button"
              role="tab"
              aria-selected={activePage === "hot"}
              onClick={() => setPage("hot")}
              className={activePage === "hot" ? "pump-tab pump-tab-on" : "pump-tab"}
            >
              常用资源
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePage === "cold"}
              onClick={() => setPage("cold")}
              className={activePage === "cold" ? "pump-tab pump-tab-on" : "pump-tab"}
            >
              不常用资源
            </button>
          </div>
        ) : null}
        {onManage ? (
          <button
            type="button"
            onClick={onManage}
            aria-label="管理资源调度图（服务器与水源）"
            className="ml-auto min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
          >
            管理
          </button>
        ) : null}
      </div>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden"
        style={{ height: boxHeight }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={reduced ? edges.map((e) => ({ ...e, animated: false })) : edges}
          onInit={(instance) => {
            flowRef.current = instance;
            requestAnimationFrame(() => fit());
          }}
          onNodeDrag={(_e, node) =>
            setDragPos({ id: node.id, x: node.position.x, y: node.position.y })
          }
          onNodeDragStop={handleNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          preventScrolling={false}
          colorMode={
            deck
              ? "light"
              : typeof window !== "undefined" &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
          }
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color="var(--border)"
          />
        </ReactFlow>
        {/* 甲板主题：水柱渐变 defs（隐藏 svg，仅供边的柱体层 stroke 引用） */}
        {deck ? (
          <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <linearGradient id={WATER_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8dcf7" stopOpacity="0.5" />
                <stop offset="55%" stopColor="#4db6e8" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#1293cc" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>
        ) : null}
        {/* 甲板主题：图面底部两层浪花（后层深水蓝错速反向、前层白沫）。
            波形改为 theme.css 里按 120px 周期精确平铺的背景贴图，任意容器
            宽度都无缝衔接、右缘铺满；纯装饰、不挡交互 */}
        {deck ? (
          <>
            <div className="deck-wave deck-wave-b" aria-hidden="true" />
            <div className="deck-wave deck-wave-a" aria-hidden="true" />
          </>
        ) : null}
      </div>
      {/* 使用情况：直接放在图下面，一行一家、竖着排（不再挂在连线上），
          跟随当前页签只列这一页的水源。顺序与图上从左到右的抽水优先级
          一致，序号与水源节点角标同号；有真实调用显真实数，暂无调用
          保留额度文案并注明暂无调用。 */}
      <div className="relative border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">使用情况</h3>
        {pageSources.length === 0 ? (
          <p className="mt-1.5 text-sm text-[var(--dim)]">这一页还没有水源。</p>
        ) : null}
        <ul className="mt-1.5 divide-y divide-[var(--border)]">
          {pageSources.map((p, i) => {
            const cfg = p.self
              ? SELF_PIPE
              : (PIPE[p.name] ?? { label: undefined, width: 2, animated: false });
            const hasReal = p.gwCalls7d != null && p.gwCalls7d > 0;
            // 口径分三档，如实写：自有通道不经网关计量（实际用量最大，
            // 不编数字）；未接网关的渠道写「未接网关计量」——无计量 ≠
            // 未使用；被计量且近 7 天为 0 的才写「暂无调用」
            const usage = p.self
              ? "自有通道 · 不经网关计量，实际用量最大"
              : hasReal
                ? `近 7 天 ${p.gwCalls7d} 次 · ${formatTokens(p.gwTokens7d ?? 0)} tokens`
                : p.gwCalls7d == null
                  ? `${cfg.label ?? p.quotaText ?? "额度待填"} · 未接网关计量`
                  : `${cfg.label ?? p.quotaText ?? "额度待填"} · 近 7 天暂无调用`;
            const brand = PUMP_BRAND[p.name] ?? { bg: "#0d5c4d", mark: "·" };
            return (
              <li key={p.key} className="flex min-h-9 items-center gap-2.5 py-1.5">
                <span
                  aria-hidden="true"
                  className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold leading-none text-[#3d2c00]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 55%), linear-gradient(90deg, #d9a521, #f0a832 55%, #ef7d4a)",
                    border: "1.5px solid #fff",
                    boxShadow: "0 1px 5px rgba(35, 40, 56, 0.35)",
                  }}
                >
                  {i + 1}
                </span>
                {p.self && selfAvatarUrl ? (
                  <img
                    src={selfAvatarUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-[26px] w-[26px] shrink-0 rounded-md object-cover"
                  />
                ) : p.self ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: "#0f766e" }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" fill="#fff" stroke="none" />
                      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
                    </svg>
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                    style={{ backgroundColor: brand.bg }}
                  >
                    {brand.mark}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">
                  {p.usageName ?? p.name}
                </span>
                <span className="shrink-0 text-sm text-[var(--ink-2)]">{usage}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

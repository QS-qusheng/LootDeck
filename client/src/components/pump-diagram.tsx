/* ── 补给泵图：React Flow（@xyflow/react，MIT）本体渲染 ─────────────────
   形态：三层——最上方一排四台服务器节点（两台云服务器 /
   Kaggle · 免费 GPU / GitHub Codespaces · 开发机），中间居中「补给泵 · 网关」
   节点，下方一排已点亮的水源节点。边从水源向上汇入泵，再从泵向上分供四台服务器。
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
   有调用，边宽改按调用量分档、标签改显「近 7 天 N 次 · M tokens」；暂无真实
   调用的渠道保留额度标签并加「（暂无调用）」，图头说明随之切换两行口径。
   居中适配：节点坐标是按全宽画布排的固定值，fitView 只在挂载时算一次——
   壳层先窄后宽、旋转屏幕、窗口改尺寸都会让初次 fit 的缩放/偏移过期，整图
   靠左、1 号节点被裁。故容器宽度一变（ResizeObserver）就重新 fitView 居中；
   minZoom 放到 0.2，窄屏能把整排缩进画面完整居中（可再捏合放大/平移看）。 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
Background,
BackgroundVariant,
BaseEdge,
EdgeLabelRenderer,
Position,
ReactFlow,
getBezierPath,
type Edge,
type EdgeProps,
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

// ── 水源边标签错位排布 ──────────────────────────────────────────────
// 六条水源边的中点横向只相隔约 93px，而标签宽 110–180px：默认全钉在
// 中点必然挤成一长条、彼此贴死。改走自定义边：标签按序号在上/中/下
// 三档纵向错开（相邻标签差 46px 以上，不相贴）、横向再微移就近贴边；
// 「（暂无调用）」拆到标签第二行（data.sub），主行只留额度信息本身。
// 标签经 EdgeLabelRenderer 渲染在最上层，带独立浅底衬 + 边框，与水柱分层。
const LABEL_DY = [-48, -2, 44, -48, -2, 44];
const LABEL_DX = [-12, 0, 10, -10, 0, 12];

type PipeEdgeData = { dy?: number; dx?: number; sub?: string };
type PipeEdgeType = Edge<PipeEdgeData, "pipe">;

function PipeEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  data,
}: EdgeProps<PipeEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const dx = data?.dx ?? 0;
  const dy = data?.dy ?? 0;
  return (
    <>
      <BaseEdge path={path} style={style} />
      {label != null && label !== "" ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX + dx}px, ${labelY + dy}px)`,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 1px 4px rgba(35, 40, 56, 0.14)",
              padding: "3px 6px",
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.3,
              color: "var(--text)",
              textAlign: "center",
              maxWidth: 168,
              pointerEvents: "none",
            }}
          >
            <span style={{ display: "block" }}>{label}</span>
            {data?.sub ? (
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 500,
                  opacity: 0.72,
                }}
              >
                {data.sub}
              </span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const EDGE_TYPES = { pipe: PipeEdge };

// 抽水优先级（左→右，序号 1 起）：先烧快过期的
const PUMP_ORDER = [
  "魔搭社区",
  "Cloudflare Workers AI",
  "OpenRouter",
  "硅基流动",
  "硅基流动新人赠金",
  "火山方舟",
];

// 网关上方四台服务器（水抽上来供它们用）：两台云服务器 + Kaggle 免费 GPU + Codespaces 开发机。
// 名称与说明为示例配置（静态展示节点，不读台账），按你自己的服务器改。
const SERVERS = [
  { name: "腾讯云 · 云服务器", sub: "云服务器" },
  { name: "香港 · 云服务器", sub: "云服务器" },
  { name: "Kaggle · 免费 GPU", sub: "每周约 30 小时 T4 x2" },
  { name: "GitHub Codespaces · 开发机", sub: "每月 60 小时 · 账号自带" },
];

// 这 6 家的品牌色块（与卡墙 BRAND 同色值，识别用）
const PUMP_BRAND: Record<string, { bg: string; mark: string }> = {
  魔搭社区: { bg: "#4f46e5", mark: "魔" },
  "Cloudflare Workers AI": { bg: "#f6821f", mark: "Cf" },
  OpenRouter: { bg: "#475569", mark: "OR" },
  硅基流动: { bg: "#0e7490", mark: "硅" },
  硅基流动新人赠金: { bg: "#0e7490", mark: "赠" },
  火山方舟: { bg: "#325ab4", mark: "火" },
};

function isLit(p: Provider): boolean {
  return p.status === "claimed" || p.status === "pooled" || p.status === "registered";
}

// 甲板主题浪花路径（纯 SVG 技法，本页自写）：120 单位一个完整波形、共 2880 宽，
// 图层以 200% 宽横向平移半程（1440＝12 个波形）即无缝循环；CSS 动画在 theme.css。
const WAVE_PATH = (() => {
  let d = "M0 22 Q 30 8 60 22";
  for (let x = 120; x <= 2880; x += 60) d += ` T ${x} 22`;
  return `${d} L 2880 40 L 0 40 Z`;
})();

// 甲板主题水柱：边的柱体层 stroke 引用的竖向水蓝渐变（浅→深、自上而下）。
// defs 由组件在开主题时渲染进面板（隐藏 svg），id 全页唯一。
const WATER_GRAD_ID = "deck-water-grad";
const WATER_STROKE = `url(#${WATER_GRAD_ID})`;

// 甲板主题云朵：顶部服务器节点的云形底衬（本页自写 SVG 路径，data URI 背景，
// 拉伸铺满节点；白云面 + 柔和水蓝描边，文字照常压在云面上清晰可读）。
const CLOUD_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 64' preserveAspectRatio='none'>" +
  "<path d='M28 55C14 55 6 45 8 35C10 25 18 19 27 19C30 7 44 1 56 5C64 -3 84 -3 94 5C106 3 120 9 125 19C138 13 154 19 158 31C172 29 182 39 180 47C178 53 170 55 160 55Z' fill='#ffffff' stroke='#7cc3e8' stroke-width='2.5'/></svg>";
const CLOUD_BG = `url("data:image/svg+xml,${encodeURIComponent(CLOUD_SVG)}")`;

const NODE_W = 156;
const GAP = 30;

export function PumpDiagram({
  providers,
  deck = false,
}: {
  providers: Provider[];
  // 甲板主题（清新版）：仅换皮——面板改海水渐变 + 底部两层 SVG 浪花、
  // 连线改水柱（宽幅半透明水蓝渐变柱体 + 虚线流光，柱宽即流量分档）、
  // 顶部服务器节点改云朵形容器、水源节点小幅硬阴影浮标感、网关节点加
  // 船舵标、浅色模式；节点、数据、布局坐标与关闭时完全一致
  deck?: boolean;
}) {
  const sources = useMemo(
    () =>
      PUMP_ORDER.map((name) => providers.find((p) => p.name === name)).filter(
        (p): p is Provider => p != null && isLit(p),
      ),
    [providers],
  );

  const { nodes, edges } = useMemo(() => {
    const totalW = sources.length * NODE_W + Math.max(0, sources.length - 1) * GAP;
    const pumpW = 224;
    // 服务器节点加宽到 248：最长的「GitHub Codespaces · 开发机」单行完整
    // 显示、不折行不溢出云形（相邻节点中心距约 271，互不重叠）
    const srvW = 248;
    const ns: Node[] = SERVERS.map((s, i) => ({
      id: `srv-${i}`,
      type: "output" as const,
      targetPosition: Position.Bottom,
      position: {
        x: (totalW * (2 * i + 1)) / (SERVERS.length * 2) - srvW / 2,
        y: 0,
      },
      draggable: false,
      selectable: false,
      data: {
        label: (
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: "#334155",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
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
            <span style={{ textAlign: "left", minWidth: 0 }}>
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
        ),
      },
      style: {
        width: srvW,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface-alt)",
        color: "var(--text)",
        padding: "8px 10px",
        // 甲板主题：云朵形容器——云形 SVG 底衬铺满节点（白云面 + 柔和水蓝
        // 描边），无边框无硬阴影，只留一层柔和投影；文字照常压在云面上
        ...(deck
          ? {
              border: "none",
              background: "transparent",
              backgroundImage: CLOUD_BG,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              boxShadow: "0 3px 8px rgba(34, 102, 148, 0.15)",
              padding: "10px 16px",
            }
          : {}),
      },
    }));
    ns.push({
        id: "pump",
        type: "default",
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        position: { x: totalW / 2 - pumpW / 2, y: 168 },
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
    // 网关向上分供四台服务器（水抽上来给它们用）。
    // 甲板主题：每条连线先垫一层宽幅半透明水蓝渐变「柱体」（水柱本体，
    // 先入数组＝渲染在下层），再叠原 animated 虚线作柱面流光；柱宽即流量。
    const es: Edge[] = [];
    SERVERS.forEach((_s, i) => {
      if (deck) {
        es.push({
          id: `srv-edge-bg-${i}`,
          source: "pump",
          target: `srv-${i}`,
          animated: false,
          style: { stroke: WATER_STROKE, strokeWidth: 10, opacity: 0.85 },
        });
      }
      es.push({
        id: `srv-edge-${i}`,
        source: "pump",
        target: `srv-${i}`,
        animated: true,
        style: {
          stroke: deck ? "#1293cc" : "var(--accent)",
          strokeWidth: 2.5,
          opacity: 0.9,
        },
      });
    });
    sources.forEach((p, i) => {
      const cfg = PIPE[p.name] ?? { width: 2, animated: false };
      const brand = PUMP_BRAND[p.name] ?? { bg: "#0d5c4d", mark: "·" };
      ns.push({
        id: `src-${p.id}`,
        type: "input",
        sourcePosition: Position.Top,
        position: { x: i * (NODE_W + GAP), y: 376 },
        draggable: false,
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
      // 优先按网关真实调用绘制：有近 7 天调用 → 边宽按调用量分档、标签显真实数；
      // 暂无真实调用 → 保留原额度口径（粗细/流动不变），额度进标签主行、
      // 「（暂无调用）」进标签第二行（data.sub），额度信息一字不删
      const hasReal = p.gwCalls7d != null && p.gwCalls7d > 0;
      const edgeLabel = hasReal
        ? `近 7 天 ${p.gwCalls7d} 次 · ${formatTokens(p.gwTokens7d ?? 0)} tokens`
        : (cfg.label ?? p.quotaText);
      const edgeWidth = hasReal ? callsToWidth(p.gwCalls7d ?? 0) : cfg.width;
      // 甲板主题：先垫水柱柱体层——宽幅半透明水蓝渐变，柱宽按同一流量
      // 分档放大（edgeWidth×2.6+3），柱宽即流量；一次性型柱体更淡
      if (deck) {
        es.push({
          id: `pipe-bg-${p.id}`,
          source: `src-${p.id}`,
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
        id: `pipe-${p.id}`,
        type: "pipe",
        source: `src-${p.id}`,
        target: "pump",
        animated: cfg.animated,
        label: edgeLabel,
        data: {
          dy: LABEL_DY[i] ?? 0,
          dx: LABEL_DX[i] ?? 0,
          sub: hasReal ? undefined : "（暂无调用）",
        },
        style: {
          // 甲板主题：柱面流光线（流动型深水蓝虚线、一次性型浅水蓝细线），
          // 粗细/流动/标签口径不变
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
    return { nodes: ns, edges: es };
  }, [sources, deck]);

  // ── 居中适配：容器宽度变化 / 水源增减后重新 fitView ──────────────────
  const flowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef(0);
  const fit = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.12, maxZoom: 1, duration: 200 });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let timer: number | undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(w - lastWidthRef.current) < 2) return;
      lastWidthRef.current = w;
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
    // sources.length 入 deps：容器 div 只在有水源时才渲染，出现后要补挂观察
  }, [fit, sources.length]);

  // 水源点亮/熄灭导致节点排布变化时也重新居中
  useEffect(() => {
    fit();
  }, [fit, nodes]);

  if (sources.length === 0) return null;

  const hasAnyReal = sources.some(
    (p) => p.gwCalls7d != null && p.gwCalls7d > 0,
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section
      aria-label="补给泵图"
      className={`deck-panel overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] ${
        deck ? "deck-aqua relative" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pb-1 pt-3">
        <h2 className="shrink-0 text-base font-semibold text-[var(--text)]">补给泵图</h2>
        <span className="text-xs text-[var(--dim)]">
          {hasAnyReal
            ? "边宽与标签按近 7 天真实调用绘制；暂无调用的渠道暂按额度绘制"
            : "暂按额度绘制：管子越粗量越大，流动的管子是每日/每周刷新的"}
        </span>
        <span className="text-xs font-medium text-[var(--text)]">
          从左到右 = 优先顺序（多任务时可同时抽多家）
        </span>
      </div>
      <div ref={wrapRef} className="h-[480px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={reduced ? edges.map((e) => ({ ...e, animated: false })) : edges}
          edgeTypes={EDGE_TYPES}
          onInit={(instance) => {
            flowRef.current = instance;
            requestAnimationFrame(() => fit());
          }}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
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
      </div>
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
      {/* 甲板主题：面板底部两层 SVG 浪花（后层深水蓝错速反向、前层白沫），
          纯装饰、不挡交互；动画与减动效处理在 theme.css 皮肤层 */}
      {deck ? (
        <>
          <svg
            className="deck-wave deck-wave-b"
            viewBox="0 0 2880 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={WAVE_PATH} fill="#1293cc" />
          </svg>
          <svg
            className="deck-wave deck-wave-a"
            viewBox="0 0 2880 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={WAVE_PATH} fill="#ffffff" />
          </svg>
        </>
      ) : null}
    </section>
  );
}

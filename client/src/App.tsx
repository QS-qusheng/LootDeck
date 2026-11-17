import {
useEffect,
useRef,
useState,
type CSSProperties,
type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import { BattlePassTrack } from "./components/ui/battle-pass-track";
import { PumpDiagram } from "./components/pump-diagram";
import { DECK_ICON_PATHS, type DeckIconName } from "./assets/deck-icon-paths";
import logoAlibabacloud from "./assets/logos/alibabacloud.svg";
import logoAws from "./assets/logos/aws.png";
import logoAzure from "./assets/logos/azure.png";
import logoBaiducloud from "./assets/logos/baiducloud.png";
import logoCloudflare from "./assets/logos/cloudflare.svg";
import logoCodex from "./assets/logos/codex.svg";
import logoDeepseek from "./assets/logos/deepseek.svg";
import logoGemini from "./assets/logos/gemini.svg";
import logoGithub from "./assets/logos/github.svg";
import logoGooglecloud from "./assets/logos/googlecloud.png";
import logoGooglecolab from "./assets/logos/googlecolab.svg";
import logoGroq from "./assets/logos/groq.svg";
import logoKaggle from "./assets/logos/kaggle.svg";
import logoMistral from "./assets/logos/mistral.svg";
import logoModelscope from "./assets/logos/modelscope.png";
import logoNewapi from "./assets/logos/newapi.png";
import logoNvidia from "./assets/logos/nvidia.png";
import logoOpenrouter from "./assets/logos/openrouter.svg";
import logoOracle from "./assets/logos/oracle.svg";
import logoQwen from "./assets/logos/qwen.svg";
import logoReducto from "./assets/logos/reducto.png";
import logoSiliconflow from "./assets/logos/siliconflow.png";
import logoStepfun from "./assets/logos/stepfun.png";
import logoVolcengine from "./assets/logos/volcengine.png";
import logoZhipu from "./assets/logos/zhipu.png";

type Provider = ApiResponse<typeof api, "listProviders">["providers"][number];

// 全站只用两档：已点亮（已领好——账号注册了、额度到手了都算）/ 未点亮（还没领）。
// 台账内部状态 claimed / pooled / registered 都归「已点亮」显示，接网关与否不在页面体现。
const LIT_META = {
  label: "已点亮",
  cls: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
};
const UNLIT_META = {
  label: "未点亮",
  cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function isLit(p: Provider): boolean {
  return p.status === "claimed" || p.status === "pooled" || p.status === "registered";
}

function metaFor(p: Provider): { label: string; cls: string } {
  return isLit(p) ? LIT_META : UNLIT_META;
}

// 领不了：优惠是新人限定，作者本人是阿里云老号、资格不满足。这两家在本类
// 内沉底，卡面挂灰色「领不了」标记，详情卡里写明原因；其余卡排序不受影响。
// 这是作者本人看板的事实，只在看板里有作者数据时成立（示例状态或作者
// 本人）；新用户自己的看板里他们可能是新号能领，不挂此标记、不沉底。
const UNCLAIMABLE: Record<string, string> = {
  阿里云新人礼包: "新人限定，老号领不了",
  阿里云百炼: "新人限定，老号领不了",
};

function unclaimableReason(p: Provider, enabled: boolean): string | null {
  return enabled ? (UNCLAIMABLE[p.name] ?? null) : null;
}

/* ── 定期任务红点：本周期还没完成就亮，完成打卡后灭，下个周期自动再亮 ── */
const CYCLE_LABEL: Record<Provider["taskCycle"], string> = {
  none: "无",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function taskDue(p: Provider): boolean {
  if (p.taskCycle === "none") return false;
  if (p.taskLastDoneAt == null) return true;
  const last = new Date(p.taskLastDoneAt);
  const now = new Date();
  if (p.taskCycle === "daily")
    return startOfDay(last).getTime() < startOfDay(now).getTime();
  if (p.taskCycle === "weekly")
    return mondayOf(last).getTime() < mondayOf(now).getTime();
  return (
    last.getFullYear() < now.getFullYear() ||
    (last.getFullYear() === now.getFullYear() && last.getMonth() < now.getMonth())
  );
}

function fmtDoneAt(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* 红点 + 周期小字（待办时才渲染） */
function TaskDot({ p }: { p: Provider }) {
  if (!taskDue(p)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold leading-4 text-red-600 dark:text-red-400">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.18)] dark:bg-red-500"
      />
      {CYCLE_LABEL[p.taskCycle]}
    </span>
  );
}

/* ── QShip 闪箔（与图鉴/登船卡同一套 .bc-fx/.bc-glare 配方） ──────────
   待机由 theme.css 的 qsDrift 漂移驱动同一组 --pointer-* 变量；
   hover 时停漂移、改由指针位置驱动（原合同）。 */
function trackPointer(e: ReactMouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  const cx = fx - 0.5;
  const cy = fy - 0.5;
  const center = Math.min(1, Math.sqrt(cx * cx + cy * cy) * 2);
  el.style.setProperty("--pointer-x", `${fx * 100}%`);
  el.style.setProperty("--pointer-y", `${fy * 100}%`);
  el.style.setProperty("--pointer-from-left", String(fx));
  el.style.setProperty("--pointer-from-top", String(fy));
  el.style.setProperty("--pointer-from-center", String(center));
}

// 每卡用 --qs-delay 错开漂移相位
function delayFor(id: number): CSSProperties {
  return { "--qs-delay": `${-((id * 37) % 9)}s` } as CSSProperties;
}

// 热卡（大羊毛推荐在册）用惊艳配方，其余点亮卡用彩虹配方
function recipeFor(p: Provider): string {
  return p.featuredRank > 0 ? "bc-r-amazing" : "bc-r-rainbow";
}

/* 闪箔层：层级合同自下而上 = 图层 → 闪箔层（混合模式压图融合） → 编号/徽章层 */
function FoilLayers() {
  return (
    <>
      <span aria-hidden="true" className="bc-fx" />
      <span aria-hidden="true" className="bc-glare" />
    </>
  );
}

/* ── 甲板主题图标（game-icons.net 海盗系列，CC BY 3.0；路径数据为本地资产） ── */
function DeckIcon({ name, className }: { name: DeckIconName; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" fill="currentColor" className={className}>
      <path d={DECK_ICON_PATHS[name]} />
    </svg>
  );
}

// 卡墙分区（顺序：提效工具置顶，其次免费VPS，其余依次 API 能打水 / 工具福利；
// 产品内羊毛整区已按用户拍板下架——只能在对方产品里花的积分不进池子）
// icon 为甲板主题下分区标题旁的海盗小图标（仅开主题时渲染，关时无此节点）
const CATEGORIES: Array<{ key: string; title: string; desc: string; icon?: DeckIconName }> = [
  { key: "efficiency", title: "提效工具", desc: "让 AI 助手升级进化的底层能力——手、眼、网关这一层", icon: "shipWheel" },
  { key: "compute", title: "免费VPS", desc: "免费的服务器 / GPU 算力，派活跑批用", icon: "anchor" },
  { key: "api", title: "API 能打水", desc: "可编程调用的 API 额度，池子的真水源", icon: "treasureChest" },
  { key: "tool", title: "工具福利", desc: "开发工具类的免费档" },
];

function groupOf(p: Provider): string {
  return CATEGORIES.some((c) => c.key === p.groupKey) ? p.groupKey : "tool";
}

/* 分区类型色（甲板主题的设计语言，参考开源图鉴项目的类型色系统、降饱和
   清新版）：API 能打水＝水蓝 / 免费VPS＝电黄 / 提效工具＝钢青灰 /
   工具福利＝草绿。与 theme.css 皮肤层里分区标题徽章的颜色同值。 */
const TYPE_META: Record<string, { title: string; color: string }> = {
  efficiency: { title: "提效工具", color: "#7d9db0" },
  compute: { title: "免费VPS", color: "#f5b301" },
  api: { title: "API 能打水", color: "#2ea6e0" },
  tool: { title: "工具福利", color: "#58b368" },
};

// 类内按实际可用价值降序（sortValue 已由服务端换算：每日刷新按 30 天累计、
// 代金券五折、免费不限量按附带赠金算），同值按台账顺序；点亮与否不影响位置。
// 例外：「领不了」的卡沉到本类末尾（仍可见），免得按价值从前往后看时误以为能领。
function bySize(a: Provider, b: Provider, noClaimEnabled: boolean): number {
  const sinkA = unclaimableReason(a, noClaimEnabled) ? 1 : 0;
  const sinkB = unclaimableReason(b, noClaimEnabled) ? 1 : 0;
  return (
    sinkA - sinkB ||
    b.sortValue - a.sortValue ||
    a.sortOrder - b.sortOrder ||
    a.id - b.id
  );
}

// 品牌色块（无官方 logo 资源时用品牌色 + 首字/缩写做识别块，点亮彩色、未点亮置灰）
const BRAND: Record<string, { bg: string; mark: string }> = {
  魔搭社区: { bg: "#4f46e5", mark: "魔" },
  "Cloudflare Workers AI": { bg: "#f6821f", mark: "Cf" },
  OpenRouter: { bg: "#475569", mark: "OR" },
  硅基流动: { bg: "#0e7490", mark: "硅" },
  硅基流动新人赠金: { bg: "#0e7490", mark: "赠" },
  火山方舟: { bg: "#325ab4", mark: "火" },
  蚂蚁灵波: { bg: "#1677ff", mark: "蚂" },
  "阶跃星辰 StepFun": { bg: "#7c2d12", mark: "阶" },
  Reducto: { bg: "#334155", mark: "Re" },
  超算互联网: { bg: "#0369a1", mark: "超" },
  超算互联网小额: { bg: "#0369a1", mark: "超" },
  百度智能云: { bg: "#2932e1", mark: "百" },
  阿里云百炼: { bg: "#ff6a00", mark: "炼" },
  阿里云新人礼包: { bg: "#ff6a00", mark: "礼" },
  DeepSeek: { bg: "#4d6bfe", mark: "DS" },
  "GitHub Models": { bg: "#24292f", mark: "GH" },
  Kaggle: { bg: "#20beff", mark: "Ka" },
  "甲骨文 Oracle": { bg: "#c74634", mark: "甲" },
  "Google Colab": { bg: "#f9ab00", mark: "Co" },
  "agent-browser": { bg: "#0f766e", mark: "ab" },
  "agent-desktop": { bg: "#0369a1", mark: "ad" },
  "Agent Reach": { bg: "#b45309", mark: "AR" },
  Scrapling: { bg: "#0e7490", mark: "Sc" },
  "new-api": { bg: "#334155", mark: "na" },
  Codex: { bg: "#10a37f", mark: "Cx" },
  Groq: { bg: "#f43e01", mark: "Gr" },
  "Google Gemini API": { bg: "#8e75b2", mark: "Gm" },
  "智谱 BigModel": { bg: "#1c1c1e", mark: "智" },
  Mistral: { bg: "#fa520f", mark: "Mi" },
  "NVIDIA Build": { bg: "#76b900", mark: "NV" },
  "Google Cloud": { bg: "#4285f4", mark: "GC" },
  "Microsoft Azure": { bg: "#0078d4", mark: "Az" },
  AWS: { bg: "#ff9900", mark: "AW" },
  示例云电脑: { bg: "#64748b", mark: "例" },
  示例海外服务器: { bg: "#475569", mark: "例" },
};
const FALLBACK_BG = ["#0d5c4d", "#b45309", "#0369a1", "#be185d", "#4d7c0f"];

/* ── 提效工具·装备图标（图形表意，不用单字块）＋稀有度描边色 ──────────
   agent-browser 浏览器窗口+光标 / agent-desktop 显示器 /
   Agent Reach 雷达信号 / Scrapling 蜘蛛网+垂丝蜘蛛 / new-api 网关阀门 / Codex 终端窗口 >_ /
   MarkItDown 文档转出 / 共享记忆库 数据库 / 本地语音 扬声器声波。
   稀有色喂 .qs-equip-slot 的 --equip。 */
const EQUIP_RARITY: Record<string, string> = {
  "agent-browser": "#a855f7",
  "agent-desktop": "#3b82f6",
  "Agent Reach": "#14b8a6",
  Scrapling: "#06b6d4",
  "new-api": "#f59e0b",
  Codex: "#10b981",
  MarkItDown: "#e11d48",
  共享记忆库: "#8b5cf6",
  本地语音: "#f97316",
};

function EquipIcon({ name, cls = "h-7 w-7" }: { name: string; cls?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: cls,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  switch (name) {
    case "agent-browser":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 8.5h18" />
          <path d="M6 6.2h.01M9 6.2h.01" strokeWidth="2.4" />
          <path d="M13.5 12.5l5.5 3.2-3.6.7 1.6 3.3-1.8.9-1.6-3.3-2.3 2.2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "agent-desktop":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M12 16v3" />
          <path d="M8 21h8" />
          <path d="M7.5 12.5l2.5-2.5 2 2 3.5-3.5" strokeWidth="1.6" />
        </svg>
      );
    case "Agent Reach":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.8" />
          <path d="M12 12L18.5 5.5" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="16.8" cy="13.8" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "Scrapling":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 4l5.2 5.2M20 4l-5.2 5.2M4 20l5.2-5.2M20 20l-5.2-5.2" strokeWidth="1.3" />
          <path d="M4 9.5c2.8 1.6 5.4 2.4 8 2.4s5.2-.8 8-2.4M6.8 4c1 2.6 2.8 4.4 5.2 5.4 2.4-1 4.2-2.8 5.2-5.4" strokeWidth="1.3" />
          <path d="M12 12.5v2.6" strokeWidth="1.4" />
          <circle cx="12" cy="17.6" r="2.1" fill="currentColor" stroke="none" />
          <path d="M10.3 16.4l-2-1.4M13.7 16.4l2-1.4M10.2 18.6l-2.2.8M13.8 18.6l2.2.8" strokeWidth="1.3" />
        </svg>
      );
    case "new-api":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M2 15h5.5M16.5 15H22" />
          <circle cx="12" cy="15" r="4.5" />
          <path d="M12 15l3-3M12 15l-3 3M12 15l-3-3M12 15l3 3" strokeWidth="1.4" />
          <path d="M12 10.5V7" />
          <path d="M7.5 7h9" />
          <circle cx="7.5" cy="7" r="1.2" />
          <circle cx="16.5" cy="7" r="1.2" />
        </svg>
      );
    case "Codex":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 8.5h18" />
          <path d="M6 6.2h.01M9 6.2h.01" strokeWidth="2.4" />
          <path d="M7 12l3.2 2.6L7 17.2" />
          <path d="M12.8 17.4h4.6" />
        </svg>
      );
    case "MarkItDown":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 15.5h6" strokeWidth="1.5" />
          <path d="M12 17.8v3M10.2 19.2l1.8 1.8 1.8-1.8" strokeWidth="1.5" />
        </svg>
      );
    case "共享记忆库":
      return (
        <svg {...common} aria-hidden="true">
          <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
          <path d="M5 5.5v6c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-6" />
          <path d="M5 11.5v6c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-6" />
        </svg>
      );
    case "本地语音":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 10v4h3l5 4.5v-13L7 10H4z" fill="currentColor" stroke="none" />
          <path d="M15.5 9.5a4 4 0 010 5" />
          <path d="M18 7a7.5 7.5 0 010 10" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      );
  }
}

/* ── 官方 Logo（本地资产，来源逐项记在 DATA-PLAN） ─────────────────────
   fit=cover：方形图面（App 图标式，自带底色）铺满整格；
   fit=contain：字标/单色字形按 QShip slot-logo-img 口径留白居中于白面。
   没有官方 Logo 的：提效工具用装备图面铺满整格，其余用品牌色块铺满整格
   （QShip slot-art--cover 的 slot-initial 同位）——都不再是居中小方块。 */
type LogoSpec = { src: string; fit: "cover" | "contain" };
const LOGOS: Record<string, LogoSpec> = {
  "new-api": { src: logoNewapi, fit: "cover" },
  Codex: { src: logoCodex, fit: "contain" },
  Kaggle: { src: logoKaggle, fit: "contain" },
  "甲骨文 Oracle": { src: logoOracle, fit: "contain" },
  "Google Colab": { src: logoGooglecolab, fit: "contain" },
  "GitHub Codespaces": { src: logoGithub, fit: "contain" },
  "火山方舟": { src: logoVolcengine, fit: "cover" },
  "Cloudflare Workers AI": { src: logoCloudflare, fit: "contain" },
  魔搭社区: { src: logoModelscope, fit: "cover" },
  OpenRouter: { src: logoOpenrouter, fit: "contain" },
  硅基流动: { src: logoSiliconflow, fit: "cover" },
  硅基流动新人赠金: { src: logoSiliconflow, fit: "cover" },
  百度智能云: { src: logoBaiducloud, fit: "cover" },
  DeepSeek: { src: logoDeepseek, fit: "contain" },
  "阶跃星辰 StepFun": { src: logoStepfun, fit: "cover" },
  阿里云新人礼包: { src: logoAlibabacloud, fit: "contain" },
  阿里云百炼: { src: logoQwen, fit: "contain" },
  Reducto: { src: logoReducto, fit: "cover" },
  "GitHub Models": { src: logoGithub, fit: "contain" },
  Groq: { src: logoGroq, fit: "cover" },
  "Google Gemini API": { src: logoGemini, fit: "contain" },
  "智谱 BigModel": { src: logoZhipu, fit: "cover" },
  Mistral: { src: logoMistral, fit: "contain" },
  "NVIDIA Build": { src: logoNvidia, fit: "contain" },
  "Google Cloud": { src: logoGooglecloud, fit: "contain" },
  "Microsoft Azure": { src: logoAzure, fit: "contain" },
  AWS: { src: logoAws, fit: "contain" },
};

/* 图层（QShip .slot-art 同位）：全站统一底衬与留白——外框白底一致，
   图形统一占格面约 78%（同一视觉重量区间），不再整格深色块/浅色块混杂；
   字标类 contain、图形类 cover 的区分保留在内框里。
   variant=tile 卡墙方卡 / chip 左列与详情卡的小方块（同规则、仅尺寸不同）。 */
function ProviderFace({
  p,
  lit,
  variant,
}: {
  p: Provider;
  lit: boolean;
  variant: "tile" | "chip";
}) {
  const logo = LOGOS[p.name];
  const gray = lit ? "" : "qs-unlit-img";
  // 甲板主题钩子：未点亮时图面底衬换浅灰蓝（仅开主题时 CSS 生效）
  const bgHook = lit ? "" : " deck-unlit-bg";
  const inner = "relative flex h-[78%] w-[78%] items-center justify-center overflow-hidden rounded-[22%]";
  if (logo) {
    return (
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center bg-white${bgHook}`}>
        <span className={inner}>
          <img
            src={logo.src}
            alt=""
            className={`h-full w-full ${logo.fit === "cover" ? "object-cover" : "object-contain"} ${gray}`}
          />
        </span>
      </span>
    );
  }
  if (groupOf(p) === "efficiency") {
    const rarity = EQUIP_RARITY[p.name] ?? "#d9a521";
    return (
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center bg-white${bgHook}`}>
        <span
          className={`qs-equip-slot ${inner} ${gray}`}
          style={{ "--equip": rarity, borderRadius: undefined } as CSSProperties}
        >
          <EquipIcon name={p.name} cls="h-[58%] w-[58%]" />
        </span>
      </span>
    );
  }
  const brand = brandFor(p);
  return (
    <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center bg-white${bgHook}`}>
      <span
        className={`${inner} text-white ${gray}`}
        style={{ backgroundColor: brand.bg }}
      >
        <span className={`font-bold ${variant === "tile" ? "text-[1.9rem]" : "text-sm"}`}>
          {brand.mark}
        </span>
      </span>
    </span>
  );
}

function brandFor(p: Provider): { bg: string; mark: string } {
  const known = BRAND[p.name];
  if (known) return known;
  let h = 0;
  for (const c of p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = FALLBACK_BG[h % FALLBACK_BG.length] ?? "#0d5c4d";
  const mark = (p.nameEn || p.name).replace(/[^a-zA-Z0-9一-鿿]/g, "").slice(0, 2) || "·";
  return { bg, mark };
}

/* ── 顶层渲染的详情卡：portal 到 body + 最高 z-index。
   点亮卡的闪箔/漂移动画各自建层叠上下文，卡内 absolute 弹层会被相邻卡压住；
   只有挂到根节点、脱离卡片层叠上下文，才能保证完整压在所有卡片之上。
   定位统一走 Floating UI（@floating-ui/react-dom，MIT）：左列条目与卡墙
   卡片同一套规则——优先落在锚点下方（bottom-start、间距 8px），下方
   放不下自动翻到上方，水平方向 shift 收回视口内（8px 边距）；autoUpdate
   让弹框在滚动/缩放时持续贴住锚点，不再用触发瞬间的手算矩形快照
   （快照会随滚动过期、不同来源还各弹各的）。 ── */
function AnchoredDetail({
  p,
  dexNo,
  noClaimEnabled,
  anchorEl,
  onHoverStart,
  onHoverEnd,
}: {
  p: Provider;
  dexNo?: number;
  noClaimEnabled: boolean;
  anchorEl: HTMLElement;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const { refs, floatingStyles, isPositioned } = useFloating({
    open: true,
    strategy: "fixed",
    placement: "bottom-start",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  });

  return createPortal(
    <div
      ref={refs.setFloating}
      className="z-[100] hidden sm:block"
      style={{
        ...floatingStyles,
        visibility: isPositioned ? "visible" : "hidden",
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <DetailCard p={p} dexNo={dexNo} noClaimEnabled={noClaimEnabled} />
    </div>,
    document.body,
  );
}

/* ── 悬停 / 点按弹出的详情小卡：四项基础信息 + 状态切换 + 尾号/备注编辑 ── */
function DetailCard({
  p,
  dexNo,
  noClaimEnabled,
  onClose,
}: {
  p: Provider;
  dexNo?: number;
  noClaimEnabled: boolean;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const uid = useRef(`dc-${p.id}-${Math.random().toString(36).slice(2, 7)}`).current;
  const [editing, setEditing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [keyTail, setKeyTail] = useState(p.keyTail);
  const [note, setNote] = useState(p.note);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["providers"] });
  const update = useMutation({
    mutationFn: async (args: Parameters<typeof api.updateProvider>[0]) =>
      await api.updateProvider(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async () => await api.deleteProvider({ id: p.id }),
    onSuccess: () => {
      invalidate();
      onClose?.();
    },
  });
  const complete = useMutation({
    mutationFn: async () => await api.completeTask({ id: p.id }),
    onSuccess: invalidate,
  });

  const lit = isLit(p);
  const meta = metaFor(p);
  const noClaim = unclaimableReason(p, noClaimEnabled);
  // 图鉴条目条用：类型徽章（按分区类型色）+ 量级属性条（sortValue 对数标尺，
  // 与卡墙排序同一口径，只作量级直观呈现）
  const typeMeta = TYPE_META[groupOf(p)] ?? { title: "工具福利", color: "#58b368" };
  const magnitudePct =
    p.sortValue > 0
      ? Math.min(100, Math.round((Math.log10(p.sortValue + 1) / 7.7) * 100))
      : 0;

  // 阅读区事实三行（管理信息——Key 尾号/备注——收进下方「管理」折叠区）
  const rows: Array<[string, string]> = [
    ["谁家的", p.backer || "—"],
    ["羊毛内容", p.quotaText || "—"],
    ["周期", p.refreshRule || "—"],
  ];

  return (
    <div className="deck-panel w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <ProviderFace p={p} lit={lit} variant="chip" />
        </span>
        <div className="min-w-0 flex-1 self-center">
          <p className="text-base font-bold leading-6 text-[var(--text)]">{p.name}</p>
          {p.nameEn && p.nameEn !== p.name ? (
            <p className="truncate text-xs leading-4 text-[var(--dim)]">{p.nameEn}</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
          {meta.label}
        </span>
        {onClose ? (
          <button
            type="button"
            aria-label="关闭详情"
            onClick={onClose}
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--dim)] active:bg-[var(--bg)]"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* 图鉴条目条（仅甲板主题显示，显隐由皮肤层 .deck-only 控制）：
          条目编号 + 类型徽章 + 量级属性条，数值都取自台账本身 */}
      <div className="deck-only mt-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--text)] px-1.5 py-0.5 font-mono text-[11px] font-bold leading-4 text-[var(--surface)]">
            No.{String(dexNo ?? p.id).padStart(3, "0")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[var(--text)] ring-1 ring-[var(--border)]">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[4px]"
              style={{ backgroundColor: typeMeta.color }}
            />
            {typeMeta.title}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] font-medium leading-4 text-[var(--dim)]">
          <span className="shrink-0">量级</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--progress-bg)]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${magnitudePct}%`, backgroundColor: typeMeta.color }}
            />
          </span>
        </div>
      </div>

      {noClaim ? (
        <p className="mt-3 rounded-lg bg-zinc-500/10 px-3 py-2 text-xs leading-5 text-zinc-600 ring-1 ring-zinc-400/40 dark:text-zinc-300">
          领不了：{noClaim}
        </p>
      ) : null}

      {/* 阅读区第一屏：先讲清「对你有什么用」，大字全文、不截断 */}
      <section aria-label={`${p.name} 对你有什么用`} className="mt-3.5">
        <h3 className="text-[13px] font-semibold leading-5 text-[var(--dim)]">对你有什么用</h3>
        <p className="mt-1 text-[15px] font-medium leading-7 text-[var(--text)]">
          {p.dailyDetail || p.quotaText || "—"}
        </p>
      </section>

      <dl className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-sm leading-5">
            <dt className="w-16 shrink-0 text-[var(--dim)]">{k}</dt>
            <dd className="min-w-0 flex-1 text-[var(--text)]">{v}</dd>
          </div>
        ))}
      </dl>

      {/* 管理区：默认折叠，入口常驻可见；点亮切换/定期任务/尾号备注都在里面，不挡阅读 */}
      <div className="mt-3 border-t border-[var(--border)] pt-1">
        <button
          type="button"
          aria-expanded={manageOpen}
          onClick={() => setManageOpen((v) => !v)}
          className="flex min-h-9 w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-[var(--text)]"
        >
          <span>管理</span>
          <span aria-hidden="true" className="text-xs text-[var(--dim)]">{manageOpen ? "▾ 收起" : "▸ 展开"}</span>
        </button>
      </div>
      {manageOpen ? (
        <div>
          <dl className="space-y-1.5 pb-1">
            <div className="flex gap-2 text-sm leading-5">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Key 尾号</dt>
              <dd className="min-w-0 flex-1 text-[var(--text)]">
                {p.keyTail ? (
                  <span className="font-mono tabular-nums">····{p.keyTail}</span>
                ) : (
                  <span className="text-[var(--dim)]">未填（完整 key 只存密钥库）</span>
                )}
              </dd>
            </div>
            {p.note ? (
              <div className="flex gap-2 text-sm leading-5">
                <dt className="w-16 shrink-0 text-[var(--dim)]">备注</dt>
                <dd className="min-w-0 flex-1 text-[var(--text)]">{p.note}</dd>
              </div>
            ) : null}
          </dl>

      {/* 点亮状态切换：只两档——已点亮 / 未点亮 */}
      <div className="mt-3 border-t border-[var(--border)] pt-3" role="group" aria-label={`${p.name} 点亮状态`}>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { lit: false, label: "未点亮" },
              { lit: true, label: "已点亮" },
            ] as const
          ).map((s) => {
            const active = lit === s.lit;
            return (
              <button
                key={s.label}
                type="button"
                aria-pressed={active}
                disabled={active || update.isPending}
                onClick={() =>
                  update.mutate({
                    id: p.id,
                    status: s.lit ? "claimed" : "unclaimed",
                  })
                }
                className={`min-h-8 rounded-full px-2.5 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg)] text-[var(--text)] ring-1 ring-[var(--border)] active:bg-[var(--border)]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 定期任务：周期 + 上次完成 + 打卡 */}
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-sm leading-5 text-[var(--text)]">
          <span className="text-[var(--dim)]">定期任务：</span>
          {p.taskCycle === "none"
            ? "无"
            : `${CYCLE_LABEL[p.taskCycle]}领取一次 · 上次完成：${
                p.taskLastDoneAt != null ? fmtDoneAt(p.taskLastDoneAt) : "暂无记录"
              }`}
          {taskDue(p) ? (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs font-semibold text-red-600 dark:text-red-400">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />
              待办
            </span>
          ) : null}
        </p>
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={`${p.name} 定期任务周期`}
        >
          {(["none", "daily", "weekly", "monthly"] as const).map((c) => {
            const active = p.taskCycle === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                disabled={active || update.isPending}
                onClick={() => update.mutate({ id: p.id, taskCycle: c })}
                className={`min-h-8 rounded-full px-2.5 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg)] text-[var(--text)] ring-1 ring-[var(--border)] active:bg-[var(--border)]"
                }`}
              >
                {c === "none" ? "无任务" : `${CYCLE_LABEL[c]}任务`}
              </button>
            );
          })}
          {p.taskCycle !== "none" ? (
            <button
              type="button"
              onClick={() => complete.mutate()}
              disabled={complete.isPending}
              className="min-h-8 rounded-full bg-red-600 px-2.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {complete.isPending ? "打卡中…" : "标记完成"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => {
            setKeyTail(p.keyTail);
            setNote(p.note);
            setEditing((v) => !v);
          }}
          className="min-h-8 rounded-lg px-2.5 text-xs font-medium text-[var(--accent)] ring-1 ring-[var(--border)]"
        >
          {editing ? "收起" : "编辑尾号 / 备注"}
        </button>
        {!p.builtin ? (
          confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => remove.mutate()}
                className="min-h-8 rounded-lg bg-red-600 px-2.5 text-xs font-medium text-white"
              >
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-8 rounded-lg px-2.5 text-xs text-[var(--dim)]"
              >
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-8 rounded-lg px-2.5 text-xs text-red-600 dark:text-red-400"
            >
              删除
            </button>
          )
        ) : null}
      </div>

      {editing ? (
        <form
          className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              {
                id: p.id,
                keyTail: keyTail.replace(/[^a-zA-Z0-9]/g, "").slice(-8),
                note,
              },
              { onSuccess: () => setEditing(false) },
            );
          }}
        >
          <div>
            <label htmlFor={`${uid}-tail`} className="text-xs font-medium text-[var(--text)]">
              Key 尾号（只填最后几位）
            </label>
            <input
              id={`${uid}-tail`}
              value={keyTail}
              onChange={(e) => setKeyTail(e.target.value)}
              placeholder="如 ab12"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)]"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-note`} className="text-xs font-medium text-[var(--text)]">备注</label>
            <textarea
              id={`${uid}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
          </div>
          {update.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400">保存失败，请重试。</p>
          ) : null}
          <button
            type="submit"
            disabled={update.isPending}
            className="min-h-9 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {update.isPending ? "保存中…" : "保存"}
          </button>
        </form>
      ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── 卡墙方卡：图层 → 闪箔层 → 徽章层（QShip 图鉴层级合同） ── */
function WoolTile({
  p,
  dexNo,
  noClaimEnabled,
  active,
  onEnter,
  onLeave,
  onTap,
}: {
  p: Provider;
  dexNo: number;
  noClaimEnabled: boolean;
  active: boolean;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
  onTap: (el: HTMLElement) => void;
}) {
  const lit = isLit(p);
  const meta = metaFor(p);
  const noClaim = unclaimableReason(p, noClaimEnabled);
  const hot = lit && p.featuredRank > 0;
  return (
    <div
      className="relative"
      onMouseEnter={(e) => onEnter(e.currentTarget)}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${p.name}，${meta.label}，${p.quotaText || "额度待填"}${taskDue(p) ? `，${CYCLE_LABEL[p.taskCycle]}定期任务待办` : ""}`}
        onClick={(e) => onTap(e.currentTarget)}
        onMouseMove={lit ? trackPointer : undefined}
        style={lit ? delayFor(p.id) : undefined}
        className="block w-full text-left"
      >
        {/* 方形卡面（QShip 原结构）：只装图层 → 闪箔层 → 徽章层；
            名字/额度在卡面下方的 meta 区，不进闪箔、保持可读 */}
        <span
          className={`deck-face relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border shadow-sm transition ${
            lit ? `qs-drift ${recipeFor(p)} qs-caught ${hot ? "qs-hot" : ""}` : "bg-[var(--surface)]"
          } ${
            active
              ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
              : lit
                ? ""
                : "border-[var(--border)]"
          }`}
        >
          {/* 图层：官方 Logo / 装备图面 / 品牌色块一律铺满整个卡面（QShip .slot-art 同位） */}
          <ProviderFace p={p} lit={lit} variant="tile" />
          {/* 闪箔层（混合模式只压图层融合，不压文字） */}
          {lit ? <FoilLayers /> : null}
          {/* 定期任务待办红点（右上角） */}
          {taskDue(p) ? (
            <span className="qs-badge-layer absolute right-1.5 top-1.5">
              <TaskDot p={p} />
            </span>
          ) : null}
        </span>
        {/* 序号角标（仅甲板主题显示，显隐与配方在 theme.css .qs-dex-badge）：
            与补给泵图水源节点同款的橙金圆角标，压在卡面左上角、骑住边角，
            不压 Logo 主体；数字为图鉴序号裸数字（无 No. 前缀、无补零，
            dexNo 由 App 按分区顺序×类内排列算好）。点亮与否靠金箔/灰蓝
            区分，角标簇不再挂对号。放在卡面 span 之外、按钮之内：
            卡面 overflow-hidden 会裁掉骑角部分，按钮内则点击仍归按钮。 */}
        <span aria-hidden="true" className="qs-dex-badge">
          {dexNo}
        </span>
        {/* meta 区：卡面下方、闪箔之外（QShip .slot-meta 同位）。
            三级层级：①名字（主、加粗）②价值一句话（完整显示、可多行、绝不截断）
            ③状态/周期小字（弱、灰）。价值句始终放全；甲板主题下三行各预留
            2 行高（theme.css .deck-card-*），同排卡片文字起点对齐收平。 */}
        <span className="mt-2 block px-0.5">
          <span
            className={`deck-card-name block text-sm font-bold leading-5 ${
              lit ? "qs-lit-name" : "text-[var(--text)]"
            }`}
          >
            {p.name}
          </span>
          <span className="deck-card-value mt-0.5 block break-words text-[13px] font-medium leading-[1.5] text-[var(--ink-2)] dark:text-[var(--ink-2)]">
            {p.quotaText || "额度待填"}
          </span>
          <span className="deck-card-status mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-[var(--dim)]">
            <span>{lit ? "已点亮" : "未点亮"}</span>
            {p.refreshRule ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{p.refreshRule}</span>
              </>
            ) : null}
            {noClaim ? (
              <span className="inline-block rounded-full bg-zinc-500/15 px-2 py-px text-[10px] font-semibold leading-4 text-zinc-500 ring-1 ring-zinc-400/50 dark:text-zinc-400">
                领不了
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </div>
  );
}

/* ── 左列推荐行 ── */
function FeaturedRow({
  p,
  noClaimEnabled,
  active,
  onEnter,
  onLeave,
  onTap,
}: {
  p: Provider;
  noClaimEnabled: boolean;
  active: boolean;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
  onTap: (el: HTMLElement) => void;
}) {
  const lit = isLit(p);
  const meta = metaFor(p);
  const noClaim = unclaimableReason(p, noClaimEnabled);
  return (
    <div
      className="relative"
      onMouseEnter={(e) => onEnter(e.currentTarget)}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={(e) => onTap(e.currentTarget)}
        onMouseMove={lit ? trackPointer : undefined}
        style={lit ? delayFor(p.id) : undefined}
        className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-2 py-1.5 text-left transition ${
          lit ? `qs-drift ${recipeFor(p)} qs-caught` : ""
        } ${
          active ? "ring-1 ring-[var(--accent)]" : lit ? "" : "active:bg-[var(--bg)]"
        }`}
      >
        {/* 图层 */}
        <span className="qs-badge-layer w-5 shrink-0 text-center text-sm font-bold tabular-nums text-amber-500">
          {p.featuredRank}
        </span>
        <span
          aria-hidden="true"
          className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-lg"
        >
          {/* 图层：Logo 铺满方块（同卡墙口径） */}
          <ProviderFace p={p} lit={lit} variant="chip" />
          {/* 闪箔层（混合模式只压图块融合，不压整行文字） */}
          {lit ? <FoilLayers /> : null}
        </span>
        {/* 编号 / 徽章层（z-index 3、保持 crisp 在最上）。
            左列只做扫榜：排名 + 名字 + 状态，不重复价值句（价值句只在卡墙与详情里） */}
        <span className="qs-badge-layer min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${lit ? "qs-lit-name" : "text-[var(--text)]"}`}>{p.name}</span>
        </span>
        {taskDue(p) ? (
          <span className="qs-badge-layer shrink-0">
            <TaskDot p={p} />
          </span>
        ) : null}
        {noClaim ? (
          <span className="qs-badge-layer shrink-0 rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-400/50 dark:text-zinc-400">
            领不了
          </span>
        ) : (
          <span className={`qs-badge-layer shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
        )}
      </button>
    </div>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.listProviders({}),
  });
  // 泵图服务器层：真实清单只存服务端、经动作下发（仅本人状态返回）
  const pumpServers = useQuery({
    queryKey: ["pumpServers"],
    queryFn: () => api.getPumpServers({}),
  });
  // 激活键带来源（f=左列推荐 / w=卡墙）：同一家会同时出现在左列与卡墙，
  // 只按 id 判活会让两处详情卡同时弹出、互相遮挡，故按来源分别判活。
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  // 详情卡走顶层 portal 渲染，锚点元素随激活键一起存（悬停与点按各一份），
  // Floating UI 据元素实时定位（滚动/缩放自动跟随）
  const [hoverEl, setHoverEl] = useState<HTMLElement | null>(null);
  const [pinnedEl, setPinnedEl] = useState<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const syncedRef = useRef(false);

  // 甲板主题为唯一呈现（2026-11-15 定版，与开源包一致）：<html> 恒挂
  // data-deck="on"（index.html 已预置、此处兜底重申），theme.css 皮肤层
  // 据此换皮（详情卡走 body portal，属性必须挂在 html 上）；无素版可切。
  const deck = true;
  useEffect(() => {
    document.documentElement.setAttribute("data-deck", "on");
  }, []);

  // 进页同步一次全量目录（幂等：只补缺、只补结构字段）
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    api
      .syncCatalog({})
      .then(() => queryClient.invalidateQueries({ queryKey: ["providers"] }))
      .catch(() => {});
  }, [queryClient]);

  const list = providers.data?.providers ?? [];
  const litCount = list.filter(isLit).length;

  // 看板状态：example＝示例状态（用户还没添置自己的战利品，整张甲板是
  // 内置示例数据，顶部横幅明确标注）；own＝用户自己的状态。自动切换在
  // 服务端（添置第一件自己的战利品时翻转清场），页面只读不设开关。
  const boardMode = providers.data?.boardMode ?? "own";
  const isExample = boardMode === "example";
  // 看板里有作者数据（示例专属条目在册）：示例状态天然成立，作者本人
  // 的看板也是这一路——泵图服务器层与「领不了」口径只对这样的看板成立；
  // 新用户翻转到自己的状态后示例专属条目已被清场，两者自动消失。
  const authorBoard = list.some((p) => p.demoOnly);

  // 图鉴编号：每个板块内部各自从 1 重新开始（定版）——板块内按显示
  // 顺序（与卡墙渲染同一套过滤/排序）编 1、2、3……，换一个板块回到 1；
  // 卡面角标与详情卡的 No. 共用这一套编号。
  const dexNoById = new Map<number, number>();
  {
    for (const cat of CATEGORIES) {
      const items = list
        .filter((p) => groupOf(p) === cat.key)
        .sort((a, b) => bySize(a, b, authorBoard));
      items.forEach((p, i) => dexNoById.set(p.id, i + 1));
    }
  }

  const featured = list
    .filter((p) => p.featuredRank > 0)
    .sort((a, b) => a.featuredRank - b.featuredRank);

  const activeKey = pinnedKey ?? hoverKey;
  const activeEl = pinnedKey ? pinnedEl : hoverEl;
  const activeId = activeKey ? Number(activeKey.slice(2)) : null;
  const activeProvider =
    activeId != null ? (list.find((p) => p.id === activeId) ?? null) : null;
  const pinnedId = pinnedKey ? Number(pinnedKey.slice(2)) : null;
  const pinned =
    pinnedId != null ? (list.find((p) => p.id === pinnedId) ?? null) : null;

  const cancelClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const tap = (key: string, el: HTMLElement) => {
    setPinnedEl(el);
    setPinnedKey((cur) => (cur === key ? null : key));
  };
  const enter = (key: string, el: HTMLElement) => {
    cancelClose();
    setHoverEl(el);
    setHoverKey(key);
  };
  // 详情卡已脱离卡片 DOM，指针移过去要点状态按钮时先给一段宽限，别立刻关
  const leave = (key: string) => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setHoverKey((cur) => (cur === key ? null : cur));
    }, 250);
  };
  const popoverHoverEnd = () => {
    if (!pinnedKey) setHoverKey(null);
  };

  return (
    <div className="deck-root min-h-screen bg-[var(--bg)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-5 lg:px-6">
        {providers.isPending ? (
          <p className="text-sm text-[var(--dim)]">加载中…</p>
        ) : providers.isError ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--text)]">台账加载失败。</p>
            <button
              type="button"
              onClick={() => providers.refetch()}
              className="mt-2 min-h-9 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white"
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {/* ── 页内无顶栏（2026-11-15 定版）：标题与主题开关整行已删，
                页面打开直接从补给泵图开始；Space 名与浏览器标题保留 ── */}
            {/* ── 示例状态横幅：整张甲板是内置示例数据时明确标注，
                别让新用户误以为是自己的真实战利品；添置第一件自己的
                战利品后服务端自动翻转清场，横幅随之消失 ── */}
            {isExample ? (
              <div
                role="note"
                className="deck-panel mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-amber-500/60 bg-amber-50 px-4 py-3 dark:bg-amber-950/40"
              >
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  示例状态
                </span>
                <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--text)]">
                  你看到的是内置示例数据，不是你的真实战利品。把下面任意一家点亮、或添置第一件你自己的战利品后，这里会自动切换成你的看板，示例不再混入。
                </p>
              </div>
            ) : null}

            {/* ── 页面最顶部：补给泵图（React Flow 本体，水源=已点亮各家） ── */}
            <div className="mb-4">
              <PumpDiagram
                providers={list}
                servers={pumpServers.data?.servers ?? []}
                deck={deck}
                showServers={isExample || authorBoard}
                isExample={isExample}
              />
            </div>

            {/* ── 战令轨道（bigbullui BattlePassTrack，MIT；tier/xp 喂点亮数） ── */}
            <div className="flex flex-wrap items-start gap-3">
              <BattlePassTrack
                tier={litCount}
                total={list.length}
                xp={litCount}
                xpMax={list.length}
                className="deck-panel min-w-0 flex-1 basis-72"
              />
            </div>

            <div className="mt-4 flex flex-col gap-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
              {/* ── 左列：大羊毛推荐 ─────────────────────────────── */}
              <aside
                aria-label="大羊毛推荐"
                className="deck-panel rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 lg:sticky lg:top-5"
              >
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  <DeckIcon
                    name="pirateFlag"
                    className="mr-2 inline h-6 w-6 align-[-5px] text-[#c9a227]"
                  />
                  大羊毛推荐
                </h2>
                <p className="mt-0.5 text-xs text-[var(--dim)]">全场量级最大的几家 · 点一家看详情</p>
                <div className="mt-2 space-y-0.5">
                  {featured.map((p) => (
                    <FeaturedRow
                      key={p.id}
                      p={p}
                      noClaimEnabled={authorBoard}
                      active={activeKey === `f:${p.id}`}
                      onEnter={(el) => enter(`f:${p.id}`, el)}
                      onLeave={() => leave(`f:${p.id}`)}
                      onTap={(el) => tap(`f:${p.id}`, el)}
                    />
                  ))}
                  {featured.length === 0 ? (
                    <p className="text-sm text-[var(--dim)]">暂无推荐。</p>
                  ) : null}
                </div>
              </aside>

              {/* ── 右列：全量卡墙（分类 + 量级排序） ─────────────── */}
              <div className="min-w-0">
                {CATEGORIES.map((cat) => {
                  const items = list
                    .filter((p) => groupOf(p) === cat.key)
                    .sort((a, b) => bySize(a, b, authorBoard));
                  const litInCat = items.filter(isLit).length;
                  return (
                    <section key={cat.key} aria-label={cat.title} className="deck-board mb-6 last:mb-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="text-base font-semibold text-[var(--text)]">
                          {cat.icon ? (
                            <DeckIcon
                              name={cat.icon}
                              className="mr-1.5 inline h-5 w-5 align-[-4px] text-[#c9a227]"
                            />
                          ) : null}
                          {cat.title}
                        </h2>
                        <span className="text-xs tabular-nums text-[var(--dim)]">
                          已点亮 {litInCat} / {items.length}
                        </span>
                        <span
                          className="qs-progress qs-progress-sm"
                          role="progressbar"
                          aria-valuenow={litInCat}
                          aria-valuemin={0}
                          aria-valuemax={items.length}
                          aria-label={`${cat.title}点亮进度`}
                        >
                          <span
                            className="qs-progress-fill block"
                            style={{
                              width: `${items.length > 0 ? Math.round((litInCat / items.length) * 100) : 0}%`,
                            }}
                          />
                        </span>
                        <span className="text-xs text-[var(--dim)]">{cat.desc}</span>
                      </div>
                      {items.length === 0 ? (
                        <p className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--dim)]">
                          这一类还没有。
                        </p>
                      ) : (
                        <div className="qs-wall mt-2">
                          {items.map((p) => (
                            <WoolTile
                              key={p.id}
                              p={p}
                              dexNo={dexNoById.get(p.id) ?? p.id}
                              noClaimEnabled={authorBoard}
                              active={activeKey === `w:${p.id}`}
                              onEnter={(el) => enter(`w:${p.id}`, el)}
                              onLeave={() => leave(`w:${p.id}`)}
                              onTap={(el) => tap(`w:${p.id}`, el)}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>

            {/* ── 甲板主题署名行（开源资产逐项署名） ── */}
            <footer className="mt-8 border-t border-[var(--border)] pt-3 text-center text-xs leading-5 text-[var(--dim)]">
              <span className="deck-trade">Fresh deck skin</span>
              ：图标来自 game-icons.net（Delapouite、Lorc
              作，CC BY 3.0）；泵图云形取自 Font Awesome Free 的 cloud
              图标（Fonticons, Inc.，CC BY 4.0）；详情弹框定位用 Floating
              UI（MIT）；标题字体 Baloo 2 来自 Google Fonts（OFL）。版式与
              类型色设计语言参考开源图鉴项目（MIT）；未使用任何宝可梦官方素材。
            </footer>
          </>
        )}
      </main>

      {/* ── 桌面端详情卡：顶层 portal 渲染，压在所有卡片（含闪箔动画层）之上 ── */}
      {activeProvider && activeEl && activeKey ? (
        <AnchoredDetail
          key={activeKey}
          p={activeProvider}
          dexNo={dexNoById.get(activeProvider.id)}
          noClaimEnabled={authorBoard}
          anchorEl={activeEl}
          onHoverStart={cancelClose}
          onHoverEnd={popoverHoverEnd}
        />
      ) : null}

      {/* ── 手机端：点按后底部弹卡 ─────────────────────────────── */}
      {pinned ? (
        <div className="fixed inset-0 z-[100] sm:hidden">
          <button
            type="button"
            aria-label="关闭详情"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPinnedKey(null)}
          />
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
            <DetailCard
              p={pinned}
              dexNo={dexNoById.get(pinned.id)}
              noClaimEnabled={authorBoard}
              onClose={() => setPinnedKey(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

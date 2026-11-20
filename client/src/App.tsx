import {
useEffect,
useRef,
useState,
type CSSProperties, type ReactNode
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
import { SafeAreaTopScrim, fileToBase64 } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { BattlePassTrack } from "./components/ui/battle-pass-track";
import { PumpDiagram, PUMP_ORDER } from "./components/pump-diagram";
import { MERGED_SKILLS, SKILL_CATALOG, type Skill, type SkillColumn } from "./skill-catalog";
import { EXCLUSIVE_GROUPS, GENERAL_TABS, MERGED_SKILL_INFO, WORKFLOWS, stepBranches, stepSkillName, workflowSkillNames, type Workflow } from "./workflow-catalog";
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

const FIELDS = actionFields<typeof Actions>();

type Provider = ApiResponse<typeof api, "listProviders">["providers"][number];
type UserSkill = ApiResponse<typeof api, "listUserAtlas">["skills"][number];
type PumpServerRow = ApiResponse<typeof api, "getPumpServers">["servers"][number];

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

/* ── 甲板主题图标（game-icons.net 海盗系列，CC BY 3.0；路径数据为本地资产） ── */
function DeckIcon({ name, className }: { name: DeckIconName; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" fill="currentColor" className={className}>
      <path d={DECK_ICON_PATHS[name]} />
    </svg>
  );
}

// 卡墙分区（顺序：技能图鉴置顶，其次免费算力，其余依次 免费Token（API可调度） / 工具福利；
// 产品内羊毛整区已按用户拍板下架——只能在对方产品里花的积分不进池子）
// icon 为甲板主题下分区标题旁的海盗小图标（仅开主题时渲染，关时无此节点）
const CATEGORIES: Array<{ key: string; title: string; desc: string; icon?: DeckIconName }> = [
  { key: "efficiency", title: "技能图鉴", desc: "按要做的事分栏的 Skill 与工具", icon: "shipWheel" },
  { key: "compute", title: "免费算力", desc: "免费的服务器和 GPU 算力", icon: "anchor" },
  { key: "api", title: "免费Token（API可调度）", desc: "能用代码调用的 API 额度", icon: "treasureChest" },
];

/* 「工具福利」板块已取消并入免费算力（2026-11-20 定）：groupKey=tool 的
   存量行（含用户自添行）整卡归入 compute 分区呈现，卡本身与数据不动，
   分区计数按并入后现算 */
function groupOf(p: Provider): string {
  if (p.groupKey === "tool") return "compute";
  return CATEGORIES.some((c) => c.key === p.groupKey) ? p.groupKey : "compute";
}

/* 分区类型色（甲板主题的设计语言，参考开源图鉴项目的类型色系统、降饱和
   清新版）：免费Token（API可调度）＝水蓝 / 免费算力＝电黄 / 技能图鉴＝钢青灰 /
   工具福利＝草绿。与 theme.css 皮肤层里分区标题徽章的颜色同值。 */
const TYPE_META: Record<string, { title: string; color: string }> = {
  efficiency: { title: "技能图鉴", color: "#7d9db0" },
  compute: { title: "免费算力", color: "#f5b301" },
  api: { title: "免费Token（API可调度）", color: "#2ea6e0" },
  tool: { title: "工具福利", color: "#58b368" },
};

// 类内按实际可用价值降序（sortValue 已由服务端换算：每日刷新按 30 天累计、
// 代金券五折、免费不限量按附带赠金算），同值按台账顺序；点亮与否不影响位置。
// 例外：「领不了」的卡沉到本类末尾（仍可见），免得按价值从前往后看时误以为能领。
// 大羊毛（featuredRank>0）优先：带 ✨ 的卡排在本板块最前面，其内部仍按价值序。
function bySize(a: Provider, b: Provider, noClaimEnabled: boolean): number {
  const featA = a.featuredRank > 0 ? 0 : 1;
  const featB = b.featuredRank > 0 ? 0 : 1;
  if (featA !== featB) return featA - featB;
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
  示例云电脑: { bg: "#009fe3", mark: "例" },
  示例海外服务器: { bg: "#4285f4", mark: "例" },
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
  示例海外服务器: { src: logoGooglecloud, fit: "contain" },
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
  const [confirmHide, setConfirmHide] = useState(false);
  // 用户自添卡的全字段编辑（名称/用途/详情/周期/谁家的/链接）
  const [fName, setFName] = useState(p.name);
  const [fQuota, setFQuota] = useState(p.quotaText);
  const [fDetail, setFDetail] = useState(p.dailyDetail);
  const [fCycle, setFCycle] = useState(p.refreshRule);
  const [fBacker, setFBacker] = useState(p.backer);
  const [fUrl, setFUrl] = useState(p.baseUrl);
  const [nameError, setNameError] = useState("");

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
  const hideCard = useMutation({
    mutationFn: async () => await api.setProviderHidden({ id: p.id, hidden: true }),
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

  // 阅读区事实三行（管理信息——Key 尾号/备注——收进下方「管理」折叠区）；
  // 填了链接的卡多一行链接（用户自添卡常用）
  const rows: Array<[string, string]> = [
    ["谁家的", p.backer || "—"],
    ["羊毛内容", p.quotaText || "—"],
    ["周期", p.refreshRule || "—"],
    ...(p.baseUrl ? [["链接", p.baseUrl] as [string, string]] : []),
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
            <dd className="min-w-0 flex-1 text-[var(--text)]">
              {k === "链接" ? (
                <a
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--accent)] underline"
                >
                  {v}
                </a>
              ) : (
                v
              )}
            </dd>
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

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => {
            setKeyTail(p.keyTail);
            setNote(p.note);
            setFName(p.name);
            setFQuota(p.quotaText);
            setFDetail(p.dailyDetail);
            setFCycle(p.refreshRule);
            setFBacker(p.backer);
            setFUrl(p.baseUrl);
            setNameError("");
            setEditing((v) => !v);
          }}
          className="min-h-8 rounded-lg px-2.5 text-xs font-medium text-[var(--accent)] ring-1 ring-[var(--border)]"
        >
          {editing ? "收起" : p.builtin ? "编辑尾号 / 备注" : "编辑这张卡"}
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
        ) : confirmHide ? (
          <>
            <button
              type="button"
              onClick={() => hideCard.mutate()}
              className="min-h-8 rounded-lg bg-zinc-600 px-2.5 text-xs font-medium text-white"
            >
              确认隐藏
            </button>
            <button
              type="button"
              onClick={() => setConfirmHide(false)}
              className="min-h-8 rounded-lg px-2.5 text-xs text-[var(--dim)]"
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmHide(true)}
            className="min-h-8 rounded-lg px-2.5 text-xs text-[var(--dim)]"
          >
            隐藏这张卡
          </button>
        )}
      </div>
      {p.builtin ? (
        <p className="mt-1.5 text-[11px] leading-4 text-[var(--dim)]">
          出厂卡不能删，可以隐藏（设置里能恢复）；状态、尾号、备注改动都只存你自己的台账。
        </p>
      ) : null}

      {editing ? (
        <form
          className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!p.builtin && !fName.trim()) {
              setNameError("先填名称。");
              return;
            }
            update.mutate(
              {
                id: p.id,
                ...(p.builtin
                  ? {}
                  : {
                      name: fName.trim(),
                      quotaText: fQuota,
                      dailyDetail: fDetail,
                      refreshRule: fCycle,
                      backer: fBacker,
                      baseUrl: fUrl,
                    }),
                keyTail: keyTail.replace(/[^a-zA-Z0-9]/g, "").slice(-8),
                note,
              },
              { onSuccess: () => setEditing(false) },
            );
          }}
        >
          {!p.builtin ? (
            <>
              <div>
                <label htmlFor={`${uid}-name`} className="text-xs font-medium text-[var(--text)]">
                  名称
                </label>
                <input
                  id={`${uid}-name`}
                  {...FIELDS.updateProvider.name}
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                />
                {nameError ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${uid}-quota`} className="text-xs font-medium text-[var(--text)]">
                  一句用途（卡面上显示的那句）
                </label>
                <input
                  id={`${uid}-quota`}
                  {...FIELDS.updateProvider.quotaText}
                  value={fQuota}
                  onChange={(e) => setFQuota(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label htmlFor={`${uid}-detail`} className="text-xs font-medium text-[var(--text)]">
                  详情（对你有什么用）
                </label>
                <textarea
                  id={`${uid}-detail`}
                  {...FIELDS.updateProvider.dailyDetail}
                  value={fDetail}
                  onChange={(e) => setFDetail(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`${uid}-cycle`} className="text-xs font-medium text-[var(--text)]">
                    周期
                  </label>
                  <input
                    id={`${uid}-cycle`}
                    {...FIELDS.updateProvider.refreshRule}
                    value={fCycle}
                    onChange={(e) => setFCycle(e.target.value)}
                    placeholder="如 每日 / 一次性"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-backer`} className="text-xs font-medium text-[var(--text)]">
                    谁家的
                  </label>
                  <input
                    id={`${uid}-backer`}
                    {...FIELDS.updateProvider.backer}
                    value={fBacker}
                    onChange={(e) => setFBacker(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor={`${uid}-url`} className="text-xs font-medium text-[var(--text)]">
                  链接
                </label>
                <input
                  id={`${uid}-url`}
                  {...FIELDS.updateProvider.baseUrl}
                  value={fUrl}
                  onChange={(e) => setFUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </div>
            </>
          ) : null}
          <div>
            <label htmlFor={`${uid}-tail`} className="text-xs font-medium text-[var(--text)]">
              Key 尾号（只填最后几位）
            </label>
            <input
              id={`${uid}-tail`}
              {...FIELDS.updateProvider.keyTail}
              value={keyTail}
              onChange={(e) => setKeyTail(e.target.value)}
              placeholder="只填最后几位，如 a1b2"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)]"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-note`} className="text-xs font-medium text-[var(--text)]">备注</label>
            <textarea
              id={`${uid}-note`}
              {...FIELDS.updateProvider.note}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
          </div>
          {update.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {update.error instanceof Error ? update.error.message : "保存失败，请重试。"}
            </p>
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

/* ── 板块内「加一张」表单：新增卡进用户数据层（addProvider），出厂目录
   不动；字段按现行卡字段（名称/一句用途/周期/谁家的/链接/详情） ── */
function AddProviderForm({
  groupKey,
  sectionTitle,
  onClose,
}: {
  groupKey: "compute" | "api";
  sectionTitle: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [quotaText, setQuotaText] = useState("");
  const [refreshRule, setRefreshRule] = useState("");
  const [backer, setBacker] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [dailyDetail, setDailyDetail] = useState("");
  const [nameError, setNameError] = useState("");
  const add = useMutation({
    mutationFn: async () =>
      await api.addProvider({
        name: name.trim(),
        groupKey,
        quotaText: quotaText.trim(),
        dailyDetail: dailyDetail.trim(),
        refreshRule: refreshRule.trim(),
        backer: backer.trim(),
        baseUrl: baseUrl.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      onClose();
    },
  });
  return (
    <form
      aria-label={`往${sectionTitle}加一张卡`}
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError("先填名称。");
          return;
        }
        add.mutate();
      }}
    >
      <p className="text-sm font-semibold text-[var(--text)]">
        往「{sectionTitle}」加一张
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="add-name" className="deck-field-label">名称 *</label>
          <input
            id="add-name"
            {...FIELDS.addProvider.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="deck-field"
            placeholder="如 我的小服务器"
          />
          {nameError ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="add-quota" className="deck-field-label">一句用途</label>
          <input
            id="add-quota"
            {...FIELDS.addProvider.quotaText}
            value={quotaText}
            onChange={(e) => setQuotaText(e.target.value)}
            className="deck-field"
            placeholder="卡面上显示的那一句"
          />
        </div>
        <div>
          <label htmlFor="add-cycle" className="deck-field-label">周期</label>
          <input
            id="add-cycle"
            {...FIELDS.addProvider.refreshRule}
            value={refreshRule}
            onChange={(e) => setRefreshRule(e.target.value)}
            className="deck-field"
            placeholder="如 每日 / 每月刷新 / 一次性"
          />
        </div>
        <div>
          <label htmlFor="add-backer" className="deck-field-label">谁家的</label>
          <input
            id="add-backer"
            {...FIELDS.addProvider.backer}
            value={backer}
            onChange={(e) => setBacker(e.target.value)}
            className="deck-field"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="add-url" className="deck-field-label">链接</label>
          <input
            id="add-url"
            {...FIELDS.addProvider.baseUrl}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="deck-field"
            placeholder="https://…"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="add-detail" className="deck-field-label">详情（对你有什么用）</label>
          <textarea
            id="add-detail"
            {...FIELDS.addProvider.dailyDetail}
            value={dailyDetail}
            onChange={(e) => setDailyDetail(e.target.value)}
            rows={2}
            className="deck-field"
          />
        </div>
      </div>
      {add.isError ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {add.error instanceof Error ? add.error.message : "没加上，请重试。"}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={add.isPending}
          className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {add.isPending ? "添加中…" : "加上"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

/* 卡面状态行用的短周期：只留周期词本身，到期日等细节只在详情卡里 */
function shortCycle(rule: string): string {
  const s = (rule.split("（")[0] ?? "")
    .replace(/至\s*\d{4}.*$/, "")
    .trim();
  return s || rule;
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
  mergedSkills,
  strongState,
}: {
  p: Provider;
  dexNo: number;
  noClaimEnabled: boolean;
  active: boolean;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
  onTap: (el: HTMLElement) => void;
  mergedSkills?: readonly string[];
  /** 资源卡墙口径：未点亮整卡灰化（图去饱和＋整卡降亮＋文字转灰），
      已点亮全彩金边金名；图鉴内的呈现不走这套（strongState=false） */
  strongState?: boolean;
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
        aria-label={`${p.name}，${meta.label}，${p.quotaText || "额度待填"}${taskDue(p) ? `，${CYCLE_LABEL[p.taskCycle]}定期任务待办` : ""}`}
        aria-describedby={mergedSkills ? `merged-skills-${p.id}` : undefined}
        onClick={(e) => onTap(e.currentTarget)}
        className="relative block w-full text-left"
      >
        {/* 方形卡面：只装图层与徽章层。点亮卡不挂任何闪箔/星光效果层
            （2026-11-20 定）：原图标全彩、正常亮度、标准卡面，状态只由
            全彩＋金边（qs-caught）表达，全栏点亮卡明暗一致；未点亮整卡
            灰化。名字/额度在卡面下方的 meta 区。 */}
        <span
          className={`deck-face relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border shadow-sm transition ${
            lit
              ? "qs-caught"
              : strongState
                ? "bg-[#e8ecf1]"
                : "bg-[var(--surface)]"
          } ${strongState && !lit ? "grayscale brightness-[.97]" : ""} ${
            active
              ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
              : lit
                ? ""
                : "border-[var(--border)]"
          }`}
        >
          {/* 图层：官方 Logo / 装备图面 / 品牌色块一律铺满整个卡面（QShip .slot-art 同位） */}
          <ProviderFace p={p} lit={lit} variant="tile" />
          {/* 定期任务待办红点（左上角内侧；右上角让给星标） */}
          {taskDue(p) ? (
            <span className="qs-badge-layer absolute left-1.5 top-1.5">
              <TaskDot p={p} />
            </span>
          ) : null}
        </span>
        {/* 大羊毛标记：与左上角序号完全同款的圆圈角标（.qs-star-badge，
            22px 圆、金底白边），放在卡片右上角与序号左右对称，圆里放 ⭐；
            未点亮时随卡灰化（qs-badge-off）。全页星星只有这一种形态；
            图例统一在卡墙最上方出现一次 */}
        {p.featuredRank > 0 ? (
          <span aria-hidden="true" className={`qs-star-badge${lit ? "" : " qs-badge-off"}`}>
            ⭐
          </span>
        ) : null}
        {/* 序号角标（仅甲板主题显示，显隐与配方在 theme.css .qs-dex-badge）：
            与补给泵图水源节点同款的橙金圆角标，压在卡面左上角、骑住边角，
            不压 Logo 主体；数字为图鉴序号裸数字（无 No. 前缀、无补零，
            dexNo 由 App 按分区顺序×类内排列算好）。点亮与否靠金箔/灰蓝
            区分，角标簇不再挂对号。放在卡面 span 之外、按钮之内：
            卡面 overflow-hidden 会裁掉骑角部分，按钮内则点击仍归按钮。 */}
        <span aria-hidden="true" className={`qs-dex-badge${lit ? "" : " qs-badge-off"}`}>
          {dexNo}
        </span>
        {/* meta 区：卡面下方、闪箔之外（QShip .slot-meta 同位）。
            三级层级：①名字（主、加粗）②价值一句话（完整显示、可多行、绝不截断）
            ③状态/周期小字（弱、灰）。价值句始终放全；甲板主题下三行各预留
            2 行高（theme.css .deck-card-*），同排卡片文字起点对齐收平。 */}
        <span className="mt-2 block px-0.5">
          <span
            className={`deck-card-name block text-sm font-bold leading-5 ${
              strongState
                ? lit
                  ? "text-[var(--text)]"
                  : "text-[var(--dim)]"
                : lit
                  ? "qs-lit-name"
                  : "text-[var(--text)]"
            }`}
          >
            {p.name}
          </span>
          <span
            className={`deck-card-value mt-0.5 block break-words text-[13px] font-medium leading-[1.5] ${
              strongState && !lit
                ? "text-[var(--dim)] opacity-80"
                : "text-[var(--ink-2)]"
            }`}
          >
            {p.quotaText || "额度待填"}
          </span>
          <span
            className={`deck-card-status mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 ${
              strongState && lit ? "font-medium text-[var(--gold-text)]" : "text-[var(--dim)]"
            }`}
          >
            <span>{lit ? "已点亮" : "未点亮"}</span>
            {p.refreshRule ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{strongState ? shortCycle(p.refreshRule) : p.refreshRule}</span>
              </>
            ) : null}
            {noClaim ? (
              <span className="inline-block rounded-full bg-zinc-500/15 px-2 py-px text-[10px] font-semibold leading-4 text-zinc-500 ring-1 ring-zinc-400/50 dark:text-zinc-400">
                领不了
              </span>
            ) : null}
          </span>
          {mergedSkills ? (
            <span id={`merged-skills-${p.id}`} className="skill-merged-badge">
              含 Skill：{mergedSkills.join("、")}
              {mergedSkills.includes("voice_generation") ? "（做视频）" : ""}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

/* ── 技能图鉴·静态技能卡：可聚焦阅读，无按钮语义、无点亮切换；
   点亮态沿用点亮金字语言，未点亮（待装）用灰蓝压暗 + 「待装」小标。
   v2：可带步骤序号（工作流步骤链）、业务专属标记、参与流程的反向标注，
   以及被引用跳转命中时的定位高亮 ── */
function SkillTile({
  skill,
  stepNo,
  exclusive,
  reverseNote,
  highlighted,
  userSkill,
  sourceLine,
  onEditUser,
  onDeleteUser,
  onHideFactory,
}: {
  skill: Skill;
  stepNo?: number;
  exclusive?: boolean;
  reverseNote?: string;
  highlighted?: boolean;
  /** 这是用户自加 Skill 时带其用户层记录（可编辑/删除）；出厂条目走隐藏 */
  userSkill?: UserSkill;
  sourceLine?: string;
  onEditUser?: (u: UserSkill) => void;
  onDeleteUser?: (u: UserSkill) => void;
  onHideFactory?: (name: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <article
      id={`skill-body-${skill.name}`}
      className={`skill-tile${highlighted ? " skill-highlighted" : ""}`}
      tabIndex={0}
      aria-labelledby={`skill-${skill.name}`}
      aria-describedby={`skill-${skill.name}-desc`}
    >
      <div className="skill-tile-labels">
        {stepNo != null ? (
          <span className="wf-step-no" aria-label={`第 ${stepNo} 步`}>{stepNo}</span>
        ) : null}
        <span className="skill-sub">{skill.sub.split("·副")[0]}</span>
        {exclusive ? <span className="skill-exclusive-badge">业务专属</span> : null}
        {userSkill ? <span className="skill-pending-badge">自加</span> : null}
        <span className="skill-calls">调用 {skill.calls} 次</span>
        {userSkill && onEditUser && onDeleteUser ? (
          <span className="ml-auto inline-flex gap-1">
            <button
              type="button"
              onClick={() => onEditUser(userSkill)}
              className="min-h-6 rounded px-1.5 text-[11px] font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
            >
              编辑
            </button>
            {confirmDel ? (
              <button
                type="button"
                onClick={() => onDeleteUser(userSkill)}
                className="min-h-6 rounded bg-red-600 px-1.5 text-[11px] font-semibold text-white"
              >
                确认删除
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                className="min-h-6 rounded px-1.5 text-[11px] font-semibold text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
              >
                删除
              </button>
            )}
          </span>
        ) : onHideFactory ? (
          <button
            type="button"
            onClick={() => onHideFactory(skill.name)}
            className="ml-auto min-h-6 rounded px-1.5 text-[11px] font-semibold text-[var(--dim)] ring-1 ring-[var(--border)]"
          >
            隐藏
          </button>
        ) : null}
      </div>
      <h4 id={`skill-${skill.name}`}>{skill.name}</h4>
      <p id={`skill-${skill.name}-desc`}>{skill.desc}</p>
      {sourceLine ? (
        <p className="mt-1.5 break-all text-[11px] leading-4 text-[var(--dim)]">{sourceLine}</p>
      ) : null}
      {reverseNote ? <p className="skill-reverse-note">{reverseNote}</p> : null}
    </article>
  );
}

/* ── 画布节点卡（Dify 工作流画布板式）：彩色方徽章（分类色＋名首字母）＋
   Skill 名（加粗、两行封顶）＋一句简介（现行卡文案、两行封顶），尺寸全场
   统一；白底圆角轻阴影，左右缘小圆连接点。状态沿现行口径：已点亮＝金边
   金名，待装＝灰蓝未亮＋「待装」标，引用＝虚线边＋「引用」标（本节点即
   引用卡：本体只有一个，点它跳回本体所在标签/宿主卡并定位高亮）。
   分支节点同款，多一枚「分支」标。 ── */
const WF_NODE_ACCENTS: Record<string, string> = {
  A: "#e0653a",
  B: "#6172d6",
  C: "#3d9e63",
  D: "#2ea6e0",
  E: "#c08a1e",
  L0: "#7d9db0",
  F: "#d1607a",
  company: "#d1607a",
  personal: "#58b368",
};

function WfNodeCard({
  name,
  desc,
  calls,
  stepNo,
  accent,
  kind,
  exclusive,
  branch,
  highlighted,
  refNote,
  bodyId,
  onJump,
}: {
  name: string;
  desc: string;
  calls?: number;
  stepNo?: number;
  accent: string;
  kind: "body" | "ref";
  exclusive?: boolean;
  branch?: boolean;
  highlighted?: boolean;
  refNote?: string;
  bodyId?: string;
  onJump?: () => void;
}) {
  const inner = (
    <>
      <div className="wf-node-head">
        <span className="wf-node-badge" style={{ background: accent }} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="wf-node-name">{name}</span>
      </div>
      <p className="wf-node-desc">{desc}</p>
      <div className="wf-node-meta">
        {stepNo != null ? <span className="wf-node-chip">第 {stepNo} 步</span> : null}
        {branch ? <span className="wf-node-chip">分支</span> : null}
        {kind === "ref" ? <span className="wf-node-chip wf-node-chip-ref">引用</span> : null}
        {exclusive ? <span className="wf-node-chip wf-node-chip-excl">业务专属</span> : null}
        {calls != null ? <span className="wf-node-chip">调用 {calls} 次</span> : null}
      </div>
    </>
  );
  const cls = `wf-node${kind === "ref" ? " wf-node-ref" : ""}${highlighted ? " skill-highlighted" : ""}`;
  if (kind === "ref") {
    return (
      <button
        type="button"
        onClick={onJump}
        title={refNote ? `${refNote} · 点此跳到本体` : undefined}
        aria-label={`${name}，引用卡，${refNote ?? ""}，点击跳到本体`}
        className={cls}
      >
        {inner}
      </button>
    );
  }
  return (
    <article id={bodyId} className={cls} tabIndex={0} aria-label={`${name}${stepNo != null ? `，第 ${stepNo} 步` : ""}`}>
      {inner}
    </article>
  );
}

/* ── 技能图鉴 v2：标签＋工作流＋通用/专属（框架 WORKFLOWS-V2 定版） ──
   结构：顶部总览常驻（三数分开、永不相加＋搜索）→ 分区切换（通用技能｜
   业务专属）→ 通用区事件标签点选（一次只显示一个标签）→ 每个标签下先列
   工作流步骤链、末尾「零散工具」格放没进流程的卡，全量卡不丢。
   本体唯一：数据源仍是 SKILL_CATALOG＋现有工具卡（WoolTile）；工作流步骤
   按名引用本体，本体在别处时渲染引用卡，点击跳回本体定位高亮。
   计数口径（条目数）：通用＝各标签之和（合并 Skill 按 MERGED_SKILLS_BY_
   COLUMN 归栏、底层甲板＝L0 目录＋现有工具卡）；业务专属单独计数，
   两边永不相加成一个总数。新增工作流只改 workflow-catalog.ts 数据。 */
/* ── 自加 / 编辑 Skill 表单（用户数据层；出厂目录只读） ──
   字段按规格 §5.3/§7.2：名称、一句简介、归属（分区＋标签）、来源
   （类型＋地址＋路径）。新建时名称与目录/合并集/已有自加同名会被拦下
   （服务端同名检查兜底）；编辑时名称锁定（工作流按名引用）。 */
function UserSkillForm({
  initial,
  existingNames,
  onClose,
}: {
  initial: UserSkill | null;
  existingNames: Set<string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.desc ?? "");
  const [zone, setZone] = useState<"general" | "exclusive">(initial?.zone ?? "general");
  const [tab, setTab] = useState(initial?.tab ?? "A");
  const [sub, setSub] = useState(initial?.sub ?? "");
  const [sourceType, setSourceType] = useState<UserSkill["sourceType"]>(
    initial?.sourceType ?? "none",
  );
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourcePath, setSourcePath] = useState(initial?.sourcePath ?? "");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () =>
      initial
        ? await api.updateUserSkill({
            id: initial.id,
            desc: desc.trim(),
            zone,
            tab,
            sub: sub.trim(),
            sourceType,
            sourceUrl: sourceUrl.trim(),
            sourcePath: sourcePath.trim(),
          })
        : await api.addUserSkill({
            name: name.trim(),
            desc: desc.trim(),
            zone,
            tab,
            sub: sub.trim(),
            sourceType,
            sourceUrl: sourceUrl.trim(),
            sourcePath: sourcePath.trim(),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userAtlas"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  const tabOptions =
    zone === "general"
      ? GENERAL_TABS.map((t) => ({ key: t.key as string, title: t.title }))
      : EXCLUSIVE_GROUPS.map((g) => ({ key: g.key as string, title: g.title }));
  return (
    <form
      aria-label={initial ? `编辑 Skill ${initial.name}` : "添加 Skill"}
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!initial && !name.trim()) {
          setError("先填名称。");
          return;
        }
        if (!desc.trim()) {
          setError("先填一句简介。");
          return;
        }
        if (!initial && existingNames.has(name.trim())) {
          setError("目录里已有这个名字，换一个。");
          return;
        }
        setError("");
        save.mutate();
      }}
    >
      <p className="text-sm font-semibold text-[var(--text)]">
        {initial ? `编辑「${initial.name}」` : "添加一个 Skill"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="us-name" className="deck-field-label">名称 *</label>
          <input
            id="us-name"
            {...FIELDS.addUserSkill.name}
            value={name}
            disabled={initial != null}
            onChange={(e) => setName(e.target.value)}
            className="deck-field disabled:opacity-60"
            placeholder="如 my-own-skill"
          />
        </div>
        <div>
          <label htmlFor="us-sub" className="deck-field-label">小分类（可空）</label>
          <input
            id="us-sub"
            {...FIELDS.addUserSkill.sub}
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            className="deck-field"
            placeholder="如 自建工具"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="us-desc" className="deck-field-label">一句简介 *</label>
          <input
            id="us-desc"
            {...FIELDS.addUserSkill.desc}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="deck-field"
            placeholder="它是干什么的，一句话说清"
          />
        </div>
        <div>
          <label htmlFor="us-zone" className="deck-field-label">分区</label>
          <select
            id="us-zone"
            value={zone}
            onChange={(e) => {
              const z = e.target.value as "general" | "exclusive";
              setZone(z);
              setTab(z === "general" ? "A" : "company");
            }}
            className="deck-field"
          >
            <option value="general">通用技能</option>
            <option value="exclusive">业务专属</option>
          </select>
        </div>
        <div>
          <label htmlFor="us-tab" className="deck-field-label">归属标签</label>
          <select
            id="us-tab"
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="deck-field"
          >
            {tabOptions.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="us-srctype" className="deck-field-label">来源类型</label>
          <select
            id="us-srctype"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as UserSkill["sourceType"])}
            className="deck-field"
          >
            <option value="none">暂无（页面显示「来源待补」）</option>
            <option value="github">GitHub 仓库</option>
            <option value="url">直达链接</option>
            <option value="bundled">随包附带</option>
          </select>
        </div>
        <div>
          <label htmlFor="us-srcurl" className="deck-field-label">来源地址</label>
          <input
            id="us-srcurl"
            {...FIELDS.addUserSkill.sourceUrl}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="deck-field"
            placeholder="https://github.com/…"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="us-srcpath" className="deck-field-label">仓库内路径（可空）</label>
          <input
            id="us-srcpath"
            {...FIELDS.addUserSkill.sourcePath}
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            className="deck-field"
            placeholder="如 skills/my-skill"
          />
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? "保存中…" : initial ? "保存修改" : "加上"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

/* ── 自建工作流（用户数据层注册表；规格 §7.3） ──
   命名＋选标签＋按步序从全部 Skill 里挑步骤组链（可含自加 Skill），
   每步可挂分支 Skill；存下后与出厂线同格按 calls 排序呈现。 */
function WorkflowBuilder({
  skillNames,
  onClose,
}: {
  skillNames: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [appliesTo, setAppliesTo] = useState("");
  const [zone, setZone] = useState<"general" | "exclusive">("general");
  const [tab, setTab] = useState("A");
  const [steps, setSteps] = useState<Array<{ skill: string; branches: string[] }>>([]);
  const [pickerQ, setPickerQ] = useState("");
  const [branchFor, setBranchFor] = useState<number | null>(null);
  const [branchPick, setBranchPick] = useState("");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () =>
      await api.addUserWorkflow({
        title: title.trim(),
        purpose: purpose.trim(),
        appliesTo: appliesTo.trim(),
        zone,
        tab,
        steps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userAtlas"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  const pickerList = skillNames
    .filter((n) => n.toLowerCase().includes(pickerQ.trim().toLowerCase()))
    .slice(0, 30);
  const tabOptions =
    zone === "general"
      ? GENERAL_TABS.map((t) => ({ key: t.key as string, title: t.title }))
      : EXCLUSIVE_GROUPS.map((g) => ({ key: g.key as string, title: g.title }));
  return (
    <form
      aria-label="新建工作流"
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setError("先给这条线起个名。");
          return;
        }
        if (steps.length === 0) {
          setError("至少挑一步，线才成链。");
          return;
        }
        setError("");
        save.mutate();
      }}
    >
      <p className="text-sm font-semibold text-[var(--text)]">新建一条工作流</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wf-title" className="deck-field-label">名称 *</label>
          <input
            id="wf-title"
            {...FIELDS.addUserWorkflow.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="deck-field"
            placeholder="如 我的发布线"
          />
        </div>
        <div>
          <label htmlFor="wf-applies" className="deck-field-label">适用（可空）</label>
          <input
            id="wf-applies"
            {...FIELDS.addUserWorkflow.appliesTo}
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
            className="deck-field"
            placeholder="什么活儿走这条线"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="wf-purpose" className="deck-field-label">一句话用途（可空）</label>
          <input
            id="wf-purpose"
            {...FIELDS.addUserWorkflow.purpose}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="deck-field"
          />
        </div>
        <div>
          <label htmlFor="wf-zone" className="deck-field-label">分区</label>
          <select
            id="wf-zone"
            value={zone}
            onChange={(e) => {
              const z = e.target.value as "general" | "exclusive";
              setZone(z);
              setTab(z === "general" ? "A" : "company");
            }}
            className="deck-field"
          >
            <option value="general">通用技能</option>
            <option value="exclusive">业务专属</option>
          </select>
        </div>
        <div>
          <label htmlFor="wf-tab" className="deck-field-label">归属标签</label>
          <select
            id="wf-tab"
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="deck-field"
          >
            {tabOptions.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <span className="deck-field-label">步骤（按顺序挑 Skill 组链）</span>
        {steps.length > 0 ? (
          <ol className="space-y-1.5">
            {steps.map((st, i) => (
              <li
                key={`${st.skill}-${i}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="wf-step-no" aria-label={`第 ${i + 1} 步`}>{i + 1}</span>
                  <span className="text-sm font-semibold text-[var(--text)]">{st.skill}</span>
                  <span className="ml-auto inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBranchFor(branchFor === i ? null : i);
                        setBranchPick("");
                      }}
                      className="min-h-7 rounded px-2 text-[11px] font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
                    >
                      加分支
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                      className="min-h-7 rounded px-2 text-[11px] font-semibold text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
                    >
                      移除
                    </button>
                  </span>
                </div>
                {st.branches.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {st.branches.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ink-2)] ring-1 ring-[var(--border)]"
                      >
                        分支 · {b}
                        <button
                          type="button"
                          aria-label={`移除分支 ${b}`}
                          onClick={() =>
                            setSteps(
                              steps.map((x, j) =>
                                j === i
                                  ? { ...x, branches: x.branches.filter((y) => y !== b) }
                                  : x,
                              ),
                            )
                          }
                          className="font-bold text-[var(--dim)]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {branchFor === i ? (
                  <div className="mt-2 flex gap-2">
                    <select
                      aria-label="选一个分支 Skill"
                      className="deck-field"
                      value={branchPick}
                      onChange={(e) => setBranchPick(e.target.value)}
                    >
                      <option value="">选一个 Skill 作分支…</option>
                      {skillNames
                        .filter((n) => n !== st.skill && !st.branches.includes(n))
                        .map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (branchPick) {
                          setSteps(
                            steps.map((x, j) =>
                              j === i ? { ...x, branches: [...x.branches, branchPick] } : x,
                            ),
                          );
                        }
                        setBranchFor(null);
                        setBranchPick("");
                      }}
                      className="min-h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
                    >
                      加上
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--dim)]">还没有步骤，从下面挑第一个。</p>
        )}
        <div className="mt-2">
          <label htmlFor="wf-picker" className="sr-only">搜索要加入的 Skill</label>
          <input
            id="wf-picker"
            value={pickerQ}
            onChange={(e) => setPickerQ(e.target.value)}
            className="deck-field"
            placeholder="搜索 Skill 名，点一下加为下一步…"
          />
          <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {pickerList.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSteps([...steps, { skill: n, branches: [] }])}
                className="min-h-7 rounded-full px-2.5 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--border)]"
              >
                ＋ {n}
              </button>
            ))}
            {pickerList.length === 0 ? (
              <span className="text-xs text-[var(--dim)]">没有匹配的 Skill。</span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? "保存中…" : "建好这条线"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function SkillAtlas({ category, providerTiles }: {
  category: (typeof CATEGORIES)[number];
  providerTiles: ReadonlyArray<{ name: string; node: ReactNode }>;
}) {
  const [zone, setZone] = useState<"general" | "exclusive">("general");
  const [tab, setTab] = useState<SkillColumn>("A");
  const [query, setQuery] = useState("");
  const [highlightSkill, setHighlightSkill] = useState<string | null>(null);
  const [highlightProvider, setHighlightProvider] = useState<string | null>(null);
  // 零散工具展开状态按标签分开存；用户手动展开/收起优先于搜索自动展开
  const [looseToggles, setLooseToggles] = useState<Record<string, boolean>>({});
  // 用户层编辑入口的开合与待编辑对象
  const [skillFormOpen, setSkillFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<UserSkill | null>(null);
  const [wfFormOpen, setWfFormOpen] = useState(false);
  const [confirmDelWf, setConfirmDelWf] = useState<string | null>(null);
  const [confirmDelLoose, setConfirmDelLoose] = useState<string | null>(null);

  // ── 用户数据层（规格 §7 双层模型）：出厂目录/注册表只读，自加 Skill 与
  // 自建工作流从服务端读回、与出厂条目同形态合并呈现、同格按 calls 排序 ──
  const queryClient = useQueryClient();
  const atlas = useQuery({
    queryKey: ["userAtlas"],
    queryFn: () => api.listUserAtlas({}),
  });
  const userSkills = atlas.data?.skills ?? [];
  const userWorkflows = atlas.data?.workflows ?? [];
  const hiddenFactory = new Set(atlas.data?.hiddenFactorySkills ?? []);
  const invalidateAtlas = () =>
    queryClient.invalidateQueries({ queryKey: ["userAtlas"] });
  const delUserSkill = useMutation({
    mutationFn: async (id: number) => await api.deleteUserSkill({ id }),
    onSuccess: invalidateAtlas,
  });
  const delUserWorkflow = useMutation({
    mutationFn: async (id: string) => await api.deleteUserWorkflow({ id }),
    onSuccess: invalidateAtlas,
  });
  const hideFactorySkill = useMutation({
    mutationFn: async (name: string) =>
      await api.setFactorySkillHidden({ name, hidden: true }),
    onSuccess: invalidateAtlas,
  });

  const userSkillAsSkill = (u: UserSkill): Skill => ({
    name: u.name,
    desc: u.desc,
    column: u.zone === "exclusive" ? "F" : (u.tab as SkillColumn),
    sub: u.sub || "自加",
    installed: true,
    calls: u.calls,
    lastUsed: u.lastUsed ?? 0,
  });
  const userSkillByName = new Map(userSkills.map((u) => [u.name, u] as const));
  const skillByName = new Map<string, Skill>([
    ...SKILL_CATALOG.map((s) => [s.name, s] as const),
    ...userSkills.map((u) => [u.name, userSkillAsSkill(u)] as const),
  ]);
  const allWorkflows: Workflow[] = [
    ...WORKFLOWS,
    ...userWorkflows.map(
      (w): Workflow => ({
        id: w.id,
        zone: w.zone,
        tab: w.tab as Workflow["tab"],
        title: w.title,
        purpose: w.purpose,
        appliesTo: w.appliesTo,
        calls: w.calls,
        lastCalledAt: w.lastCalledAt ?? 0,
        steps: w.steps.map((s) =>
          s.branches.length > 0 ? { skill: s.skill, branches: s.branches } : s.skill,
        ),
      }),
    ),
  ];
  const userWorkflowIds = new Set(userWorkflows.map((w) => w.id));
  // 步骤挑选器可选的全部 Skill 名（出厂目录＋合并 Skill＋自加 Skill）
  const pickerSkillNames = [
    ...new Set([
      ...SKILL_CATALOG.map((s) => s.name),
      ...Object.keys(MERGED_SKILL_INFO),
      ...userSkills.map((u) => u.name),
    ]),
  ].sort();

  const sourceLineFor = (u: UserSkill): string => {
    if (u.sourceType === "bundled") return "来源：随包附带";
    if (u.sourceType === "github" || u.sourceType === "url") {
      return `来源：${u.sourceUrl || "（未填地址）"}${u.sourcePath ? ` · ${u.sourcePath}` : ""}`;
    }
    return "来源待补";
  };
  const openEditSkill = (u: UserSkill) => {
    setEditingSkill(u);
    setSkillFormOpen(true);
  };

  const tabTitle = (key: SkillColumn): string =>
    key === "L0" ? "底层甲板" : (GENERAL_TABS.find((t) => t.key === key)?.title ?? key);

  const exclusiveSkills = SKILL_CATALOG.filter((s) => s.column === "F");

  // ── 本体定位与跳转 ──
  // 本体所在处：目录 Skill → 其栏标签；合并 Skill → 底层甲板宿主工具卡；
  // 专属 Skill → 专属区分组。
  const locateSkill = (name: string): { zone: "general" | "exclusive"; tab: SkillColumn } | null => {
    const skill = skillByName.get(name);
    if (skill) {
      if (skill.column === "F") return { zone: "exclusive", tab: "F" };
      return { zone: "general", tab: skill.column };
    }
    if (MERGED_SKILL_INFO[name]) return { zone: "general", tab: "L0" };
    return null;
  };
  const jumpToBody = (name: string) => {
    const merged = MERGED_SKILL_INFO[name];
    if (merged) {
      setZone("general");
      setTab("L0");
      setHighlightSkill(null);
      setHighlightProvider(merged.hostProviderName);
      return;
    }
    const loc = locateSkill(name);
    if (!loc) return;
    setZone(loc.zone);
    if (loc.zone === "general") setTab(loc.tab);
    setHighlightProvider(null);
    setHighlightSkill(name);
  };
  useEffect(() => {
    if (!highlightSkill && !highlightProvider) return;
    const id = highlightSkill
      ? `skill-body-${highlightSkill}`
      : `atlas-provider-${highlightProvider}`;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [highlightSkill, highlightProvider, zone, tab]);

  // ── 搜索：按名/用途过滤当前视图 ──
  const q = query.trim().toLowerCase();
  const matches = (name: string, desc: string): boolean =>
    q === "" || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);

  // 某 Skill 参与的全部工作流（反向标注用）：返回第一条命中的
  // 「流程名（所在标签）第 N 步」。
  const reverseNoteFor = (name: string): string | undefined => {
    for (const wf of allWorkflows) {
      const where =
        wf.zone === "exclusive" ? "业务专属" : tabTitle(wf.tab as SkillColumn);
      for (let i = 0; i < wf.steps.length; i++) {
        const step = wf.steps[i];
        if (!step) continue;
        if (stepSkillName(step) === name) {
          return `参与的流程：${wf.title}（${where}）第 ${i + 1} 步`;
        }
        if (stepBranches(step).includes(name)) {
          return `参与的流程：${wf.title}（${where}）第 ${i + 1} 步分支`;
        }
      }
    }
    return undefined;
  };

  // 渲染一条工作流：独立成区——实色头（线名＋用途＋适用＋步数/点亮）＋
  // 点阵画布（节点链沿基线横排，超宽在画布内横向滚动）。currentTab＝当前
  // 所在标签/组键：步骤本体与当前处同标签时是本体节点，否则是引用节点；
  // 步骤带 branches 时该节点向右一对多分叉，分支节点同款。
  const renderWorkflow = (wf: Workflow, currentTab: SkillColumn | "company" | "personal") => {
    const accent = WF_NODE_ACCENTS[currentTab] ?? "#7d9db0";
    const allSteps = wf.steps.map((step, i) => ({
      name: stepSkillName(step),
      branches: stepBranches(step),
      stepNo: i + 1,
    }));
    const steps = allSteps.filter(({ name }) => {
      const skill = skillByName.get(name);
      const merged = MERGED_SKILL_INFO[name];
      return matches(name, skill?.desc ?? merged?.desc ?? "");
    });
    if (q !== "" && steps.length === 0 && !wf.title.toLowerCase().includes(q)) return null;
    const branchCount = allSteps.reduce((n, s) => n + s.branches.length, 0);

    const renderNode = (name: string, stepNo: number | undefined, branch: boolean) => {
      const skill = skillByName.get(name);
      const merged = MERGED_SKILL_INFO[name];
      const isBodyHere =
        skill != null &&
        (wf.zone === "exclusive" ? skill.column === "F" : skill.column === currentTab);
      if (skill && isBodyHere) {
        return (
          <WfNodeCard
            name={name}
            desc={skill.desc}
            calls={skill.calls}
            stepNo={stepNo}
            accent={accent}
            kind="body"
            exclusive={wf.zone === "exclusive"}
            branch={branch}
            highlighted={highlightSkill === name}
            bodyId={`skill-body-${name}`}
          />
        );
      }
      if (skill) {
        return (
          <WfNodeCard
            name={name}
            desc={skill.desc}
            calls={skill.calls}
            stepNo={stepNo}
            accent={accent}
            kind="ref"
            branch={branch}
            refNote={`本体：${skill.column === "F" ? "业务专属区" : tabTitle(skill.column)}`}
            onJump={() => jumpToBody(name)}
          />
        );
      }
      if (merged) {
        return (
          <WfNodeCard
            name={name}
            desc={merged.desc}
            calls={merged.calls}
            stepNo={stepNo}
            accent={accent}
            kind="ref"
            branch={branch}
            refNote={`本体：底层甲板「${merged.hostProviderName}」卡`}
            onJump={() => jumpToBody(name)}
          />
        );
      }
      return (
        <WfNodeCard
          name={name}
          desc="条目已删除"
          stepNo={stepNo}
          accent={accent}
          kind="ref"
          branch={branch}
          refNote="条目已删除 · 点此处理"
          onJump={() => {}}
        />
      );
    };

    return (
      <section key={wf.id} className="wf-canvas-block" aria-labelledby={`wf-${wf.id}`}>
        <div className="wf-canvas-head">
          <div className="wf-canvas-title-row">
            <span className="wf-canvas-badge" style={{ background: accent }} aria-hidden="true">
              {wf.title.charAt(0)}
            </span>
            <h4 id={`wf-${wf.id}`}>{wf.title}</h4>
            <span className="wf-canvas-meta">
              共 {allSteps.length} 步 · 调用 {wf.calls} 次
              {branchCount > 0 ? ` · 分支 ${branchCount}` : ""}
            </span>
            {userWorkflowIds.has(wf.id) ? (
              confirmDelWf === wf.id ? (
                <span className="inline-flex gap-1">
                  <button
                    type="button"
                    onClick={() => delUserWorkflow.mutate(wf.id)}
                    className="min-h-7 rounded-full bg-red-600 px-2.5 text-xs font-semibold text-white"
                  >
                    确认删除这条线
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelWf(null)}
                    className="min-h-7 rounded-full px-2.5 text-xs text-[var(--dim)] ring-1 ring-[var(--border)]"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelWf(wf.id)}
                  className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
                >
                  删除（自建）
                </button>
              )
            ) : null}
          </div>
          <p className="wf-canvas-purpose">{wf.purpose}</p>
          <p className="wf-canvas-applies">适用：{wf.appliesTo}</p>
        </div>
        <div className="wf-canvas-scroll">
          <ol className="wf-chain">
            {steps.map(({ name, branches, stepNo }, i) => (
              <li key={`${wf.id}-${name}`} className="wf-step-item">
                {i > 0 ? <span className="wf-link" aria-hidden="true" /> : null}
                <div className="wf-step-main">
                  {renderNode(name, stepNo, false)}
                  {branches.length > 0 ? (
                    <div className="wf-branch-stack">
                      {branches.map((b) => (
                        <div key={`${wf.id}-${name}-br-${b}`} className="wf-branch-item">
                          {renderNode(b, undefined, true)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  };

  // 某标签下：工作流（先列）＋零散工具（末尾）。返回 { workflows, loose }
  // 本体清单＝出厂目录（去掉被隐藏的）＋自加 Skill（同标签），合并现算
  const tabBodySkills = (key: SkillColumn): Skill[] => [
    ...SKILL_CATALOG.filter((s) => s.column === key && !hiddenFactory.has(s.name)),
    ...userSkills
      .filter((u) => u.zone === "general" && u.tab === key)
      .map(userSkillAsSkill),
  ];
  const bodyStepsOf = (key: SkillColumn): Set<string> => {
    const set = new Set<string>();
    for (const wf of allWorkflows) {
      if (wf.zone !== "general" || wf.tab !== key) continue;
      for (const name of workflowSkillNames(wf)) {
        const skill = skillByName.get(name);
        if (skill && skill.column === key) set.add(name);
      }
    }
    return set;
  };

  // 格内排序：工作流链之间、Skill 列表内部按调用次数降序（同数按最近
  // 调用优先）；只在当前标签格内生效，不跨标签、不动链内步序。
  const byCallsWf = (a: Workflow, b: Workflow): number =>
    b.calls - a.calls || b.lastCalledAt - a.lastCalledAt;
  const byCallsSkill = (a: Skill, b: Skill): number =>
    b.calls - a.calls || b.lastUsed - a.lastUsed;

  // 本体卡的管理入口：自加 Skill 可编辑/删除，出厂条目可隐藏（只藏不阉）
  const tilePropsFor = (s: Skill) => {
    const u = userSkillByName.get(s.name);
    return u
      ? {
          userSkill: u,
          sourceLine: sourceLineFor(u),
          onEditUser: openEditSkill,
          onDeleteUser: (x: UserSkill) => delUserSkill.mutate(x.id),
        }
      : { onHideFactory: (name: string) => hideFactorySkill.mutate(name) };
  };

  const renderGeneralTab = (key: SkillColumn) => {
    const workflows = allWorkflows.filter(
      (wf) => wf.zone === "general" && wf.tab === key,
    )
      .slice()
      .sort(byCallsWf);
    const inFlow = bodyStepsOf(key);
    const loose = tabBodySkills(key)
      .filter((s) => !inFlow.has(s.name) && matches(s.name, s.desc))
      .sort(byCallsSkill);
    const looseProviders =
      key === "L0"
        ? providerTiles.filter(({ name }) => q === "" || name.toLowerCase().includes(q))
        : [];
    const wfNodes = workflows.map((wf) => renderWorkflow(wf, key));
    const hasWf = wfNodes.some((n) => n != null);
    const isWriting = key === "E";
    return (
      <div key={key}>
        {wfNodes}
        {isWriting ? (
          <section className="wf-block" aria-label="写内容与文档本体卡">
            <div className="wf-head">
              <h4>本体卡</h4>
              <span className="wf-purpose">这个标签只有 1 条本体卡，也是短剧生产线的第 2 步。</span>
            </div>
            <div className="skill-loose-grid">
              {tabBodySkills(key)
                .filter((s) => matches(s.name, s.desc))
                .sort(byCallsSkill)
                .map((s) => (
                  <SkillTile
                    key={s.name}
                    skill={s}
                    reverseNote={reverseNoteFor(s.name)}
                    highlighted={highlightSkill === s.name}
                    {...tilePropsFor(s)}
                  />
                ))}
            </div>
          </section>
        ) : null}
        {!isWriting && (loose.length > 0 || looseProviders.length > 0 || q === "") ? (
          <section className="wf-block" aria-label={`${tabTitle(key)}零散工具`}>
            {(() => {
              const looseCount = loose.length + looseProviders.length;
              const autoOpen =
                (q !== "" && looseCount > 0) ||
                (highlightSkill != null && loose.some((s) => s.name === highlightSkill)) ||
                (highlightProvider != null &&
                  looseProviders.some(({ name }) => name === highlightProvider));
              const open = looseToggles[key] ?? autoOpen;
              return (
                <>
                  <div className="wf-head">
                    <h4>零散工具</h4>
                    <span className="wf-purpose">零散工具 {looseCount} 个</span>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setLooseToggles((t) => ({ ...t, [key]: !open }))
                      }
                      className="ml-auto min-h-8 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
                    >
                      {open ? "收起" : "展开"}
                    </button>
                  </div>
                  {open ? (
                    <>
                      {loose.length > 0 ? (
                        <ul className="skill-loose-list">
                          {loose.map((s) => {
                            const note = reverseNoteFor(s.name);
                            // 只标注跨标签参与的流程，同标签流程里已在上方链中呈现
                            const crossNote =
                              note && !inFlow.has(s.name) ? note : undefined;
                            const u = userSkillByName.get(s.name);
                            return (
                              <li
                                key={s.name}
                                id={`skill-body-${s.name}`}
                                className={`skill-loose-row${highlightSkill === s.name ? " skill-highlighted" : ""}`}
                              >
                                <span className="skill-loose-name">{s.name}</span>
                                <span className="skill-loose-desc">
                                  {s.desc}
                                  {crossNote ? `（${crossNote}）` : ""}
                                </span>
                                <span className="skill-loose-calls">调用 {s.calls} 次</span>
                                {u ? (
                                  <span className="skill-loose-actions">
                                    <button type="button" onClick={() => openEditSkill(u)}>
                                      编辑
                                    </button>
                                    {confirmDelLoose === s.name ? (
                                      <button
                                        type="button"
                                        className="danger"
                                        onClick={() => delUserSkill.mutate(u.id)}
                                      >
                                        确认删除
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelLoose(s.name)}
                                      >
                                        删除
                                      </button>
                                    )}
                                  </span>
                                ) : (
                                  <span className="skill-loose-actions">
                                    <button
                                      type="button"
                                      onClick={() => hideFactorySkill.mutate(s.name)}
                                    >
                                      隐藏
                                    </button>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {looseProviders.length > 0 ? (
                        <div className="qs-wall mt-3">
                          {looseProviders.map(({ name, node }) => (
                            <div
                              key={name}
                              id={`atlas-provider-${name}`}
                              className={highlightProvider === name ? "skill-highlighted" : undefined}
                            >
                              {node}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {loose.length === 0 && looseProviders.length === 0 ? (
                        <p className="text-sm text-[var(--dim)]">当前搜索下没有零散工具。</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              );
            })()}
          </section>
        ) : null}
        {!hasWf && !isWriting && loose.length === 0 && looseProviders.length === 0 && q !== "" ? (
          <p className="mt-3 text-sm text-[var(--dim)]">当前视图里没有匹配的技能。</p>
        ) : null}
      </div>
    );
  };

  const renderExclusive = () => {
    const companyWf = allWorkflows.filter(
      (wf) => wf.zone === "exclusive" && wf.tab === "company",
    )
      .slice()
      .sort(byCallsWf);
    const personalWf = allWorkflows.filter(
      (wf) => wf.zone === "exclusive" && wf.tab === "personal",
    )
      .slice()
      .sort(byCallsWf);
    const inFlow = new Set<string>();
    for (const wf of [...companyWf, ...personalWf])
      for (const n of workflowSkillNames(wf)) inFlow.add(n);
    return (
      <div>
        {EXCLUSIVE_GROUPS.map((group) => {
          const groupSkills = [
            ...(group.key === "company"
              ? exclusiveSkills.filter(
                  (s) => s.name !== "douyin-personal-publishing" && !hiddenFactory.has(s.name),
                )
              : exclusiveSkills.filter(
                  (s) => s.name === "douyin-personal-publishing" && !hiddenFactory.has(s.name),
                )),
            ...userSkills
              .filter((u) => u.zone === "exclusive" && u.tab === group.key)
              .map(userSkillAsSkill),
          ];
          const loose = groupSkills
            .filter((s) => !inFlow.has(s.name) && matches(s.name, s.desc))
            .sort(byCallsSkill);
          const groupWf = group.key === "company" ? companyWf : personalWf;
          return (
            <section key={group.key} className="wf-block" aria-labelledby={`excl-${group.key}`}>
              <div className="wf-head">
                <h4 id={`excl-${group.key}`}>{group.title}</h4>
              </div>
              {groupWf.map((wf) => renderWorkflow(wf, group.key))}
              {loose.length > 0 ? (
                <div className="skill-loose-grid">
                  {loose.map((s) => (
                    <SkillTile
                      key={s.name}
                      skill={s}
                      exclusive
                      highlighted={highlightSkill === s.name}
                      {...tilePropsFor(s)}
                    />
                  ))}
                </div>
              ) : null}
              {groupSkills.length === 0 && groupWf.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">这一组还没有技能。</p>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <section aria-label={category.title} className="deck-board mb-6 last:mb-0">
      {/* ── 头部第一行：标题＋搜索框（标题行只留标题，说明小字已按
          2026-11-20 口径收掉） ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold text-[var(--text)]">
          {category.icon ? <DeckIcon name={category.icon} className="mr-1.5 inline h-5 w-5 align-[-4px] text-[#c9a227]" /> : null}
          {category.title}
        </h2>
        <label className="skill-search ml-auto">
          <span className="sr-only">搜索技能</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按技能名搜索当前视图…"
            aria-label="搜索技能（按名过滤当前视图）"
          />
        </label>
      </div>

      {/* ── 头部第二行：分区切换＋标签 pills 同行 ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="skill-zone-switch" role="group" aria-label="技能分区切换">
          <button
            type="button"
            aria-pressed={zone === "general"}
            onClick={() => setZone("general")}
            className={zone === "general" ? "skill-zone-btn skill-zone-btn-on" : "skill-zone-btn"}
          >
            通用技能
          </button>
          <button
            type="button"
            aria-pressed={zone === "exclusive"}
            onClick={() => setZone("exclusive")}
            className={zone === "exclusive" ? "skill-zone-btn skill-zone-btn-on" : "skill-zone-btn"}
          >
            业务专属
          </button>
        </div>
        {zone === "general" ? (
          <div className="skill-v2-tabs" role="tablist" aria-label="按要做的事选标签">
            {GENERAL_TABS.map((t) => {
              const selected = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.key)}
                  className={selected ? "skill-tab-btn skill-tab-btn-on" : "skill-tab-btn"}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        ) : null}
        <span className="ml-auto inline-flex gap-2">
          <button
            type="button"
            aria-expanded={skillFormOpen}
            onClick={() => {
              setEditingSkill(null);
              setSkillFormOpen((v) => !v);
            }}
            className="min-h-8 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
          >
            ＋ 添加 Skill
          </button>
          <button
            type="button"
            aria-expanded={wfFormOpen}
            onClick={() => setWfFormOpen((v) => !v)}
            className="min-h-8 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
          >
            ＋ 新建工作流
          </button>
        </span>
      </div>

      {skillFormOpen ? (
        <UserSkillForm
          initial={editingSkill}
          existingNames={
            new Set([
              ...SKILL_CATALOG.map((s) => s.name),
              ...Object.keys(MERGED_SKILL_INFO),
            ])
          }
          onClose={() => {
            setSkillFormOpen(false);
            setEditingSkill(null);
          }}
        />
      ) : null}
      {wfFormOpen ? (
        <WorkflowBuilder
          skillNames={pickerSkillNames}
          onClose={() => setWfFormOpen(false)}
        />
      ) : null}

      {zone === "general" ? renderGeneralTab(tab) : renderExclusive()}
    </section>
  );
}


/* ── 补给泵服务器清单管理（规格 §4.3 P0：清单在数据层，可增删改） ──
   折叠面板挂在资源调度图正下方；图与图下呈现都读同一份清单、改完
   现算。状态行可多条（文本＋色调），职责标签逗号分隔录入。 */
const PUMP_TONES = [
  { key: "ok", label: "正常（绿）" },
  { key: "due", label: "待处理（金）" },
  { key: "warn", label: "异常（红）" },
  { key: "muted", label: "弱化（灰）" },
] as const;

function ServerForm({
  initial,
  onClose,
}: {
  initial: PumpServerRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [sub, setSub] = useState(initial?.sub ?? "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join("，"));
  const [freq, setFreq] = useState<"hot" | "cold">(initial?.freq ?? "hot");
  const [statusRows, setStatusRows] = useState<
    Array<{ text: string; tone: "ok" | "due" | "warn" | "muted" }>
  >(
    initial?.status.map((s) => ({ text: s.text, tone: s.tone })) ?? [
      { text: "运行中", tone: "ok" as const },
    ],
  );
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        sub: sub.trim(),
        tags: tagsText
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        status: statusRows
          .filter((r) => r.text.trim())
          .map((r) => ({ text: r.text.trim(), tone: r.tone })),
        freq,
      };
      return initial
        ? await api.updatePumpServer({ id: initial.id, ...payload })
        : await api.addPumpServer(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pumpServers"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  return (
    <form
      aria-label={initial ? `编辑服务器 ${initial.name}` : "加一台服务器"}
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("先填名称。");
          return;
        }
        setError("");
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sv-name" className="deck-field-label">名称 *</label>
          <input
            id="sv-name"
            {...FIELDS.addPumpServer.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="deck-field"
            placeholder="如 我的小机"
          />
        </div>
        <div>
          <label htmlFor="sv-sub" className="deck-field-label">小字说明</label>
          <input
            id="sv-sub"
            {...FIELDS.addPumpServer.sub}
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            className="deck-field"
            placeholder="如 家里 · 常开"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sv-tags" className="deck-field-label">职责标签（逗号分隔）</label>
          <input
            id="sv-tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            className="deck-field"
            placeholder="如 桥与守望，派工中枢"
          />
        </div>
        <div>
          <label htmlFor="sv-freq" className="deck-field-label">使用频率（决定分页）</label>
          <select
            id="sv-freq"
            value={freq}
            onChange={(e) => setFreq(e.target.value as "hot" | "cold")}
            className="deck-field"
          >
            <option value="hot">常用（主页面）</option>
            <option value="cold">不常用（第二页）</option>
          </select>
        </div>
        <div>
          <span className="deck-field-label">状态行</span>
          <div className="space-y-1.5">
            {statusRows.map((r, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  aria-label={`状态 ${i + 1} 文本`}
                  value={r.text}
                  onChange={(e) =>
                    setStatusRows(
                      statusRows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                    )
                  }
                  className="deck-field"
                  placeholder="如 运行中"
                />
                <select
                  aria-label={`状态 ${i + 1} 色调`}
                  value={r.tone}
                  onChange={(e) =>
                    setStatusRows(
                      statusRows.map((x, j) =>
                        j === i
                          ? { ...x, tone: e.target.value as "ok" | "due" | "warn" | "muted" }
                          : x,
                      ),
                    )
                  }
                  className="deck-field w-auto shrink-0"
                >
                  {PUMP_TONES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`删除状态 ${i + 1}`}
                  onClick={() => setStatusRows(statusRows.filter((_, j) => j !== i))}
                  className="min-h-9 shrink-0 rounded-lg px-2 text-sm text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
                >
                  删
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setStatusRows([...statusRows, { text: "", tone: "ok" }])}
              className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
            >
              ＋ 加一行状态
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? "保存中…" : initial ? "保存修改" : "加上"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

/* ── 水源编辑表单（管理面板内）：走台账 updateProvider，与卡墙详情卡是
   同一条数据路径；出厂水源不可改名（目录按名对齐），其余字段可改 ── */
function SourceForm({
  initial,
  onClose,
}: {
  initial: Provider;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [quotaText, setQuotaText] = useState(initial.quotaText);
  const [refreshRule, setRefreshRule] = useState(initial.refreshRule);
  const [backer, setBacker] = useState(initial.backer);
  const [lit, setLit] = useState(isLit(initial));
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () =>
      await api.updateProvider({
        id: initial.id,
        ...(initial.builtin ? {} : { name: name.trim() }),
        quotaText: quotaText.trim(),
        refreshRule: refreshRule.trim(),
        backer: backer.trim(),
        status: lit ? "claimed" : "unclaimed",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  return (
    <form
      aria-label={`编辑水源 ${initial.name}`}
      className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!initial.builtin && !name.trim()) {
          setError("先填名称。");
          return;
        }
        setError("");
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="src-name" className="deck-field-label">名称{initial.builtin ? "（出厂水源不可改名）" : " *"}</label>
          <input
            id="src-name"
            {...FIELDS.updateProvider.name}
            value={name}
            disabled={initial.builtin}
            onChange={(e) => setName(e.target.value)}
            className="deck-field disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="src-quota" className="deck-field-label">一句用途</label>
          <input
            id="src-quota"
            {...FIELDS.updateProvider.quotaText}
            value={quotaText}
            onChange={(e) => setQuotaText(e.target.value)}
            className="deck-field"
          />
        </div>
        <div>
          <label htmlFor="src-cycle" className="deck-field-label">周期</label>
          <input
            id="src-cycle"
            {...FIELDS.updateProvider.refreshRule}
            value={refreshRule}
            onChange={(e) => setRefreshRule(e.target.value)}
            className="deck-field"
          />
        </div>
        <div>
          <label htmlFor="src-backer" className="deck-field-label">谁家的</label>
          <input
            id="src-backer"
            {...FIELDS.updateProvider.backer}
            value={backer}
            onChange={(e) => setBacker(e.target.value)}
            className="deck-field"
          />
        </div>
        <div>
          <label htmlFor="src-lit" className="deck-field-label">状态</label>
          <select
            id="src-lit"
            value={lit ? "lit" : "unlit"}
            onChange={(e) => setLit(e.target.value === "lit")}
            className="deck-field"
          >
            <option value="lit">已点亮（在图上供水）</option>
            <option value="unlit">未点亮（撤下图）</option>
          </select>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? "保存中…" : "保存修改"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
        >
          取消
        </button>
      </div>
    </form>
  );
}

/* ── 资源调度图管理面板：图的就地管理入口（图标题行「管理」钮打开的就
   是这一块，与图下入口同一套逻辑、同一份数据，不做两套） ──
   上下两排一起管：服务器排走 pump_servers 数据层增删改；Token 水源排
   走台账（providers）——与卡墙是同一批条目、同一条数据路径，在这里
   改完卡墙与图同步变，不存在两份数据、不会两处不一致。水源排只列
   当前在图上的（已点亮且在册）；「加水源」＝往台账加一张 API 卡、
   点亮并登记进图的顺序表。左右顺序（优先顺序）在图上直接拖动改，
   这里不重复做排序控件。 */
function PumpManager({
  servers,
  sources,
  selfName,
  sourceOrder,
  open,
  onOpenChange,
  onOpenSettings,
}: {
  servers: PumpServerRow[];
  sources: Provider[];
  selfName: string;
  sourceOrder: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PumpServerRow | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null);
  const [editingSrc, setEditingSrc] = useState<Provider | null>(null);
  const [confirmDelSrcId, setConfirmDelSrcId] = useState<number | null>(null);
  const [addingSrc, setAddingSrc] = useState(false);
  const [srcName, setSrcName] = useState("");
  const [srcQuota, setSrcQuota] = useState("");
  const [srcCycle, setSrcCycle] = useState("");
  const [srcBacker, setSrcBacker] = useState("");
  const [srcError, setSrcError] = useState("");
  const del = useMutation({
    mutationFn: async (id: number) => await api.deletePumpServer({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pumpServers"] }),
  });
  const delSrc = useMutation({
    mutationFn: async (id: number) => await api.deleteProvider({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
  const hideSrc = useMutation({
    mutationFn: async (id: number) => await api.setProviderHidden({ id, hidden: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
  const addSrc = useMutation({
    mutationFn: async () => {
      const created = await api.addProvider({
        name: srcName.trim(),
        groupKey: "api",
        quotaText: srcQuota.trim(),
        refreshRule: srcCycle.trim(),
        backer: srcBacker.trim(),
      });
      // 加进图：点亮＋把名字登记进图的顺序表（排在自有通道之前）
      await api.updateProvider({ id: created.id, status: "claimed" });
      const names = [...sourceOrder];
      if (!names.includes(srcName.trim())) {
        const selfAt = names.indexOf("__self__");
        if (selfAt >= 0) names.splice(selfAt, 0, srcName.trim());
        else names.push(srcName.trim());
      }
      await api.setPumpSourceOrder({ names });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      setAddingSrc(false);
      setSrcName("");
      setSrcQuota("");
      setSrcCycle("");
      setSrcBacker("");
      setSrcError("");
    },
    onError: (e) => setSrcError(e instanceof Error ? e.message : "添加失败，请重试。"),
  });
  return (
    <section
      aria-label="资源调度图管理"
      className="deck-panel mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-[var(--text)]">资源调度图管理</h3>
        <span className="text-xs text-[var(--dim)]">
          服务器 {servers.length} 台 · 水源 {sources.length + 1} 家（含自有通道）
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="ml-auto min-h-8 rounded-full px-3 text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
        >
          {open ? "收起" : "管理"}
        </button>
      </div>
      {open ? (
        <div className="mt-2">
          <h4 className="mt-1 text-xs font-semibold text-[var(--dim)]">服务器排（上面一排）</h4>
          <ul className="divide-y divide-[var(--border)]">
            {servers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text)]">
                    {s.name}
                    {s.demo ? <span className="ml-1.5 text-[11px] text-[var(--dim)]">（示例）</span> : null}
                  </span>
                  <span className="block truncate text-xs text-[var(--dim)]">
                    {s.freq === "hot" ? "常用页" : "不常用页"}
                    {s.sub ? ` · ${s.sub}` : ""}
                    {s.tags.length ? ` · ${s.tags.join("、")}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(s);
                    setAdding(false);
                  }}
                  className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
                >
                  编辑
                </button>
                {confirmDelId === s.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => del.mutate(s.id)}
                      className="min-h-8 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelId(null)}
                      className="min-h-8 rounded-lg px-2 text-xs text-[var(--dim)]"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelId(s.id)}
                    className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
                  >
                    删除
                  </button>
                )}
              </li>
            ))}
          </ul>
          {servers.length === 0 ? (
            <p className="py-2 text-sm text-[var(--dim)]">清单是空的，加第一台。</p>
          ) : null}
          {adding ? (
            <ServerForm initial={null} onClose={() => setAdding(false)} />
          ) : editing ? (
            <ServerForm initial={editing} onClose={() => setEditing(null)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-2 min-h-9 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
            >
              ＋ 加一台服务器
            </button>
          )}

          <h4 className="mt-5 text-xs font-semibold text-[var(--dim)]">
            Token 水源排（下面一排，与卡墙同一份台账，改动双向同步）
          </h4>
          <ul className="divide-y divide-[var(--border)]">
            {sources.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text)]">
                    {p.name}
                    {p.builtin ? null : <span className="ml-1.5 text-[11px] text-[var(--dim)]">自加</span>}
                  </span>
                  <span className="block truncate text-xs text-[var(--dim)]">
                    {p.quotaText || "额度待填"}
                    {p.refreshRule ? ` · ${p.refreshRule}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingSrc(p)}
                  className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
                >
                  编辑
                </button>
                {p.builtin ? (
                  <button
                    type="button"
                    onClick={() => hideSrc.mutate(p.id)}
                    className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--dim)] ring-1 ring-[var(--border)]"
                  >
                    隐藏（撤下图）
                  </button>
                ) : confirmDelSrcId === p.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => delSrc.mutate(p.id)}
                      className="min-h-8 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelSrcId(null)}
                      className="min-h-8 rounded-lg px-2 text-xs text-[var(--dim)]"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelSrcId(p.id)}
                    className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-red-600 ring-1 ring-[var(--border)] dark:text-red-400"
                  >
                    删除
                  </button>
                )}
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text)]">
                  {selfName} · 自有通道
                </span>
                <span className="block truncate text-xs text-[var(--dim)]">
                  不经网关计量 · 名字与头像是你的 Muse 的身份，在设置里改
                </span>
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
              >
                改身份
              </button>
            </li>
          </ul>
          {editingSrc ? (
            <SourceForm initial={editingSrc} onClose={() => setEditingSrc(null)} />
          ) : null}
          {addingSrc ? (
            <form
              aria-label="往资源调度图加一家水源"
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!srcName.trim()) {
                  setSrcError("先填名称。");
                  return;
                }
                setSrcError("");
                addSrc.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="addsrc-name" className="deck-field-label">名称 *</label>
                  <input
                    id="addsrc-name"
                    {...FIELDS.addProvider.name}
                    value={srcName}
                    onChange={(e) => setSrcName(e.target.value)}
                    className="deck-field"
                  />
                </div>
                <div>
                  <label htmlFor="addsrc-quota" className="deck-field-label">一句用途</label>
                  <input
                    id="addsrc-quota"
                    {...FIELDS.addProvider.quotaText}
                    value={srcQuota}
                    onChange={(e) => setSrcQuota(e.target.value)}
                    className="deck-field"
                  />
                </div>
                <div>
                  <label htmlFor="addsrc-cycle" className="deck-field-label">周期</label>
                  <input
                    id="addsrc-cycle"
                    {...FIELDS.addProvider.refreshRule}
                    value={srcCycle}
                    onChange={(e) => setSrcCycle(e.target.value)}
                    className="deck-field"
                  />
                </div>
                <div>
                  <label htmlFor="addsrc-backer" className="deck-field-label">谁家的</label>
                  <input
                    id="addsrc-backer"
                    {...FIELDS.addProvider.backer}
                    value={srcBacker}
                    onChange={(e) => setSrcBacker(e.target.value)}
                    className="deck-field"
                  />
                </div>
              </div>
              {srcError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{srcError}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={addSrc.isPending}
                  className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {addSrc.isPending ? "添加中…" : "加进图里"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingSrc(false)}
                  className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)]"
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSrc(true)}
              className="mt-2 min-h-9 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
            >
              ＋ 加一家水源
            </button>
          )}
          <p className="mt-3 text-xs leading-5 text-[var(--dim)]">
            两排的左右顺序就是优先顺序：在图上直接拖动节点调换，松手即存。服务器与水源的增删改都只写你自己的数据层。
          </p>
        </div>
      ) : null}
    </section>
  );
}

/* ── 设置抽屉（规格 §7.5）：管理类入口统一收这里——看板状态切换、
   恢复示例呈现、网关地址、数据导出/导入、已隐藏条目恢复、版本号 ── */
function SettingsDrawer({
  open,
  onClose,
  boardMode,
  hiddenProviders,
}: {
  open: boolean;
  onClose: () => void;
  boardMode: "example" | "own";
  hiddenProviders: Provider[];
}) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings({}),
    enabled: open,
  });
  const atlas = useQuery({
    queryKey: ["userAtlas"],
    queryFn: () => api.listUserAtlas({}),
    enabled: open,
  });
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (settings.data) setGatewayUrl(settings.data.gatewayUrl);
  }, [settings.data]);
  // 自有通道身份（资源调度图槽位显示的名字/头像，用户数据层）
  const identity = useQuery({
    queryKey: ["selfIdentity"],
    queryFn: () => api.getSelfIdentity({}),
    enabled: open,
  });
  const [selfName, setSelfName] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<{
    dataBase64: string;
    mimeType: string;
  } | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (identity.data) setSelfName(identity.data.name ?? "");
  }, [identity.data]);
  const saveIdentity = useMutation({
    mutationFn: async () =>
      await api.setSelfIdentity({
        name: selfName.trim(),
        ...(pendingAvatar ? { avatar: pendingAvatar } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selfIdentity"] });
      setPendingAvatar(null);
      setPendingAvatarUrl(null);
      setNotice("自有通道身份已保存，资源调度图上即时生效。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  const removeAvatar = useMutation({
    mutationFn: async () =>
      await api.setSelfIdentity({ name: selfName.trim(), removeAvatar: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selfIdentity"] });
      setNotice("头像已移除，回到通用图标。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "移除失败，请重试。"),
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["providers"] });
    queryClient.invalidateQueries({ queryKey: ["pumpServers"] });
    queryClient.invalidateQueries({ queryKey: ["userAtlas"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };
  const switchMode = useMutation({
    mutationFn: async (mode: "example" | "own") => {
      if (mode === "example") {
        // 回示例呈现前先把出厂目录同步回台账（只补行、不动用户数据）
        await api.syncCatalog({});
      }
      return await api.setBoardMode({ mode });
    },
    onSuccess: (_r, mode) => {
      invalidateAll();
      setNotice(mode === "example" ? "已切回示例呈现，你自己的数据一条没动。" : "已切到我的看板。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "切换失败，请重试。"),
  });
  const saveGateway = useMutation({
    mutationFn: async () => await api.setGatewayUrl({ url: gatewayUrl.trim() }),
    onSuccess: () => {
      invalidateAll();
      setNotice("网关地址已保存。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "保存失败，请重试。"),
  });
  const unhideProvider = useMutation({
    mutationFn: async (id: number) => await api.setProviderHidden({ id, hidden: false }),
    onSuccess: invalidateAll,
  });
  const unhideSkill = useMutation({
    mutationFn: async (name: string) =>
      await api.setFactorySkillHidden({ name, hidden: false }),
    onSuccess: invalidateAll,
  });
  const exportMut = useMutation({
    mutationFn: async () => await api.exportData({}),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lootdeck-data.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice("已导出 lootdeck-data.json。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "导出失败，请重试。"),
  });
  const importMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => await api.importData({ data }),
    onSuccess: () => {
      invalidateAll();
      setNotice("导入完成，页面已按导入的数据刷新。");
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "导入失败，请重试。"),
  });
  if (!open) return null;
  const hiddenSkills = atlas.data?.hiddenFactorySkills ?? [];
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="settings-drawer" role="dialog" aria-modal="true" aria-label="设置">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text)]">设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="ml-auto min-h-9 min-w-9 rounded-full text-lg text-[var(--dim)] ring-1 ring-[var(--border)]"
          >
            ×
          </button>
        </div>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">看板状态</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
            当前：{boardMode === "example" ? "示例状态（展示内置示例数据）" : "我的看板（只显示自己的数据）"}。
            切回示例只是换呈现，你自己添置的数据不会被删。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={boardMode === "own" || switchMode.isPending}
              onClick={() => switchMode.mutate("own")}
              className="min-h-9 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)] disabled:opacity-40"
            >
              我的看板
            </button>
            <button
              type="button"
              disabled={boardMode === "example" || switchMode.isPending}
              onClick={() => switchMode.mutate("example")}
              className="min-h-9 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)] disabled:opacity-40"
            >
              恢复示例呈现
            </button>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">网关地址</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
            自建网关（new-api）的访问地址，调用统计按它对接；留空表示未接。
          </p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="网关地址"
              {...FIELDS.setGatewayUrl.url}
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              className="deck-field"
              placeholder="https://…"
            />
            <button
              type="button"
              disabled={saveGateway.isPending}
              onClick={() => saveGateway.mutate()}
              className="min-h-9 shrink-0 rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">自有通道身份</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
            资源调度图水源排的「自有通道」格显示你自己的 Muse 的名字与头像（不经网关计量的那条通道）。只存你自己的数据层，留空就显示「我的 Muse」与通用图标。
          </p>
          <div className="mt-2 flex items-center gap-2">
            {pendingAvatarUrl || identity.data?.avatarUrl ? (
              <img
                src={pendingAvatarUrl ?? identity.data?.avatarUrl ?? ""}
                alt="自有通道头像预览"
                className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
              />
            ) : null}
            <input
              aria-label="自有通道名字"
              {...FIELDS.setSelfIdentity.name}
              value={selfName}
              onChange={(e) => setSelfName(e.target.value)}
              className="deck-field"
              placeholder="我的 Muse"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]">
              换头像
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                aria-label="选择自有通道头像图片"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 2_000_000) {
                    setNotice("头像图片超过 2MB，换一张小一点的。");
                    return;
                  }
                  fileToBase64(f)
                    .then(({ dataBase64, mimeType }) => {
                      setPendingAvatar({ dataBase64, mimeType });
                      setPendingAvatarUrl(URL.createObjectURL(f));
                    })
                    .catch(() => setNotice("读图片失败，头像没换。"));
                }}
              />
            </label>
            <button
              type="button"
              disabled={saveIdentity.isPending}
              onClick={() => saveIdentity.mutate()}
              className="min-h-9 rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              保存身份
            </button>
            {identity.data?.avatarUrl ? (
              <button
                type="button"
                disabled={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
                className="min-h-9 rounded-lg px-3 text-sm text-[var(--dim)] ring-1 ring-[var(--border)] disabled:opacity-50"
              >
                移除头像
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">数据导出 / 导入</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
            导出的是你自己的数据层（卡、服务器、自加 Skill、自建工作流）；导入会按同名合并、服务器清单整体替换。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate()}
              className="min-h-9 rounded-lg px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)] disabled:opacity-50"
            >
              导出 JSON
            </button>
            <label className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]">
              导入 JSON
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="选择要导入的 JSON 文件"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  f.text()
                    .then((text) => {
                      let parsed: unknown;
                      try {
                        parsed = JSON.parse(text);
                      } catch {
                        setNotice("这个文件不是有效的 JSON，没导入。");
                        return;
                      }
                      if (typeof parsed !== "object" || parsed == null) {
                        setNotice("文件内容不对，没导入。");
                        return;
                      }
                      importMut.mutate(parsed as Record<string, unknown>);
                    })
                    .catch(() => setNotice("读文件失败，没导入。"));
                }}
              />
            </label>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">已隐藏的卡</h3>
          {hiddenProviders.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--dim)]">没有隐藏的卡。</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {hiddenProviders.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => unhideProvider.mutate(p.id)}
                    className="min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
                  >
                    恢复显示
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">已隐藏的出厂 Skill</h3>
          {hiddenSkills.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--dim)]">没有隐藏的出厂 Skill。</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {hiddenSkills.map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{name}</span>
                  <button
                    type="button"
                    onClick={() => unhideSkill.mutate(name)}
                    className="min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
                  >
                    恢复显示
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {notice ? (
          <p className="mt-5 rounded-lg bg-[var(--bg)] px-3 py-2 text-xs leading-5 text-[var(--text)]">
            {notice}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-[var(--dim)]">战利品甲板 v62</p>
      </aside>
    </>
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
  // 自有通道槽位的运行时身份（用户自己的 Muse 的名字/头像，用户数据层）
  const selfIdentity = useQuery({
    queryKey: ["selfIdentity"],
    queryFn: () => api.getSelfIdentity({}),
  });
  // 资源调度图管理面板（图标题行「管理」钮与图下面板同一套逻辑）
  const [pumpMgrOpen, setPumpMgrOpen] = useState(false);
  const pumpMgrRef = useRef<HTMLDivElement | null>(null);
  const openPumpManager = () => {
    setPumpMgrOpen(true);
    requestAnimationFrame(() =>
      pumpMgrRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  // 图上拖动调序落库：服务器排写 pump_servers.sortOrder、水源排写
  // settings 的顺序表，都只写用户数据层
  const reorderServersMut = useMutation({
    mutationFn: async (ids: number[]) => await api.reorderPumpServers({ ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pumpServers"] }),
  });
  const reorderSourcesMut = useMutation({
    mutationFn: async (names: string[]) => await api.setPumpSourceOrder({ names }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
  // 激活键带来源（f=大羊毛推荐分区 / w=卡墙）：同一家会同时出现在大羊毛
  // 分区与所属分类卡墙，只按 id 判活会让两处详情卡同时弹出、互相遮挡，
  // 故按来源分别判活。
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
  // 隐藏只影响呈现与计数（规格 §7「只藏不阉」）：台账行不动，页面与
  // 全部计数都走 visible；设置抽屉的恢复名单走 list 全量
  const visible = list.filter((p) => !p.hidden);
  const litCount = visible.filter(isLit).length;
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 资源板块「加一张」表单的展开板块（一次只开一个）
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);

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
      const items = visible
        .filter((p) => groupOf(p) === cat.key)
        .sort((a, b) => bySize(a, b, authorBoard));
      items.forEach((p, i) => dexNoById.set(p.id, i + 1));
    }
  }

  // ✨ 图例只出现一次：挂在第一个含大羊毛卡（featuredRank>0）的板块上
  const firstFeaturedCatKey = CATEGORIES.find((cat) =>
    visible.some((p) => groupOf(p) === cat.key && p.featuredRank > 0),
  )?.key;

  const activeKey = pinnedKey ?? hoverKey;
  const activeEl = pinnedKey ? pinnedEl : hoverEl;
  const activeId = activeKey ? Number(activeKey.slice(2)) : null;
  const activeProvider =
    activeId != null ? (visible.find((p) => p.id === activeId) ?? null) : null;
  const pinnedId = pinnedKey ? Number(pinnedKey.slice(2)) : null;
  const pinned =
    pinnedId != null ? (visible.find((p) => p.id === pinnedId) ?? null) : null;

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
                  这是内置示例数据，不是你的真实记录。点亮任意一家、或添置第一件自己的战利品后，会自动切换成你的看板。
                </p>
              </div>
            ) : null}

            {/* ── 页面最顶部：资源调度图（React Flow 本体，水源=已点亮各家） ── */}
            <div className="mb-2">
              <PumpDiagram
                providers={visible}
                servers={pumpServers.data?.servers ?? []}
                serversDemo={pumpServers.data?.demo ?? false}
                deck={deck}
                isExample={isExample}
                selfIdentity={selfIdentity.data ?? undefined}
                sourceOrder={providers.data?.pumpSourceOrder ?? []}
                onManage={openPumpManager}
                onReorderServers={(ids) => reorderServersMut.mutate(ids)}
                onReorderSources={(names) => reorderSourcesMut.mutate(names)}
              />
            </div>
            {/* ── 资源调度图管理面板：与图标题行「管理」钮同一套逻辑——
                服务器排（pump_servers）＋水源排（台账，与卡墙同一份） ── */}
            <div ref={pumpMgrRef}>
              <PumpManager
                servers={pumpServers.data?.servers ?? []}
                sources={visible.filter(
                  (p) =>
                    isLit(p) &&
                    (PUMP_ORDER.includes(p.name) ||
                      (providers.data?.pumpSourceOrder ?? []).includes(p.name)),
                )}
                selfName={selfIdentity.data?.name ?? "我的 Muse"}
                sourceOrder={providers.data?.pumpSourceOrder ?? []}
                open={pumpMgrOpen}
                onOpenChange={setPumpMgrOpen}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </div>

            <div className="mt-4">
              {/* ── 全量卡墙（分类 + 量级排序；原大羊毛推荐板块已取消，
                  8 条并回各板块原卡、加 ✨ 标记并排在板块前面） ── */}
              <div className="min-w-0">
                {/* ⭐ 图例全页只出现一次：卡墙最上方一行小字 */}
                {firstFeaturedCatKey ? (
                  <p className="mb-3 text-xs text-[var(--dim)]">⭐＝量级最大、最值得先领的几家</p>
                ) : null}
                {/* ── 战令轨道（bigbullui BattlePassTrack，MIT；tier/xp 喂
                    点亮数）：紧贴免费算力 正上方（点亮条 → 免费算力 →
                    免费Token），内容/计数/样式不动，只改落点 ── */}
                <div className="mb-6 flex flex-wrap items-start gap-3">
                  <BattlePassTrack
                    tier={litCount}
                    total={visible.length}
                    xp={litCount}
                    xpMax={visible.length}
                    className="deck-panel min-w-0 flex-1 basis-72"
                  />
                </div>
                {[
                  ...CATEGORIES.filter((c) => c.key !== "efficiency"),
                  ...CATEGORIES.filter((c) => c.key === "efficiency"),
                ].map((cat) => {
                  const items = visible
                    .filter((p) => groupOf(p) === cat.key)
                    .sort((a, b) => bySize(a, b, authorBoard));
                  const litInCat = items.filter(isLit).length;
                  if (cat.key === "efficiency") {
                    return (
                      <SkillAtlas
                        key={cat.key}
                        category={cat}
                        providerTiles={items.map((p) => ({
                          name: p.name,
                          node: (
                            <WoolTile
                              key={p.id}
                              p={p}
                              dexNo={dexNoById.get(p.id) ?? p.id}
                              noClaimEnabled={authorBoard}
                              active={activeKey === `w:${p.id}`}
                              onEnter={(el) => enter(`w:${p.id}`, el)}
                              onLeave={() => leave(`w:${p.id}`)}
                              onTap={(el) => tap(`w:${p.id}`, el)}
                              mergedSkills={MERGED_SKILLS[p.name]}
                            />
                          ),
                        }))}
                      />
                    );
                  }
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
                        {/* 标题行右侧只留计数＋细进度条，紧凑靠右收尾；
                            说明句与图例都不挂标题行（图例统一在卡墙最上方） */}
                        <span className="ml-auto flex items-center gap-3">
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
                        </span>
                      </div>
                      {items.length === 0 ? (
                        <p className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--dim)]">
                          这一类还没有。点下面「＋ 加一张」添第一张。
                        </p>
                      ) : null}
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
                            strongState
                          />
                        ))}
                        {/* 板块末尾的加卡格：新增卡进用户数据层，出厂卡不动 */}
                        <button
                          type="button"
                          className="add-card-tile"
                          aria-expanded={addOpenFor === cat.key}
                          aria-label={`往${cat.title}加一张卡`}
                          onClick={() =>
                            setAddOpenFor(addOpenFor === cat.key ? null : cat.key)
                          }
                        >
                          <span className="add-plus" aria-hidden="true">＋</span>
                          <span>加一张</span>
                        </button>
                      </div>
                      {addOpenFor === cat.key ? (
                        <AddProviderForm
                          groupKey={cat.key === "api" ? "api" : "compute"}
                          sectionTitle={cat.title}
                          onClose={() => setAddOpenFor(null)}
                        />
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>

            {/* ── 甲板主题署名行（开源资产逐项署名） ── */}
            <footer className="mt-8 border-t border-[var(--border)] pt-3 text-center text-xs leading-5 text-[var(--dim)]">
              <span>战利品甲板 v62</span>
              {" · "}
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

      {/* ── 设置入口（右下角固定按钮）＋设置抽屉：管理类入口统一收进
          抽屉，不散落页面（规格 §7.5） ── */}
      <button
        type="button"
        className="settings-fab"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen(true)}
      >
        设置
      </button>
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        boardMode={boardMode}
        hiddenProviders={list.filter((p) => p.hidden)}
      />
    </div>
  );
}

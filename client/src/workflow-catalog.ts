// 工作流注册表（技能图鉴 v2 定版数据，来源 WORKFLOWS-V2.md 2026-11-20）。
// 可扩展设计：一份注册表同时供图鉴展示与调度判读——每条工作流有稳定 ID、
// 名称、归属（分区＋标签/组）、适用活儿（判读表：来活时凭这些说法先判线、
// 再调用那条线；判不出线的活落零散/临时线，不硬塞）。新增工作流只往
// WORKFLOWS 里加一条数据，不改页面结构；步骤按 Skill 名引用本体，
// 换技能只改引用名，不重写页面。
import type { SkillColumn } from "./skill-catalog";

export type WorkflowZone = "general" | "exclusive";

/** 一个步骤：默认是 Skill 名（字符串简写）；对象形态可补充源节点与阶段。
    kind 缺省为 skill；gate/seat 可不引用 Skill，分别表示关口与复审席。
    branches 是该节点向右一对多分叉的分支 Skill 名列表（分支节点与普通
    节点同款呈现：徽章＋名＋一句简介）。现行工作流暂无真实分支数据，
    结构先留好，后续加分支只填数据、不改页面。 */
export type WorkflowStep =
  | string
  | ({
      node?: string;
      title?: string;
      /** 执行顺序对应的展示阶段（从 1 起），标题取自 Workflow.stages。 */
      stage?: number;
      /** 关口副注或源阶段等需要保留的说明。 */
      note?: string;
      branches?: readonly string[];
    } & (
      | { skill: string; kind?: "skill" }
      | { skill?: string; kind: "gate" | "seat" }
    ));

/** 步骤的主 Skill 名（分支不计入步序）；无 Skill 的关口/席位返回空串。 */
export const stepSkillName = (step: WorkflowStep): string =>
  typeof step === "string" ? step : (step.skill ?? "");

/** 步骤的分支 Skill 名列表（无分支时为空）。 */
export const stepBranches = (step: WorkflowStep): readonly string[] =>
  typeof step === "string" ? [] : (step.branches ?? []);

/** 一条工作流涉及的全部 Skill 名：主步骤在前、各自的分支紧随其后。 */
export const workflowSkillNames = (wf: Workflow): string[] => {
  const names: string[] = [];
  for (const step of wf.steps) {
    const skill = stepSkillName(step);
    if (skill) names.push(skill);
    names.push(...stepBranches(step));
  }
  return names;
};

export type Workflow = {
  id: string;
  zone: WorkflowZone;
  /** 通用区：所属事件标签（栏键）；专属区：所属组键 */
  tab: SkillColumn | "company" | "personal";
  title: string;
  purpose: string;
  /** 判读表：这条线适用的活儿 / 典型说法，调度判读与图鉴展示共用 */
  appliesTo: string;
  /** 调用次数（标签内排序用；初值按现行顺序折算保序，不是真实统计，
      真实累加靠调度判读侧后续接线） */
  calls: number;
  /** 最近调用时间戳（毫秒；初值同上，为保序折算值） */
  lastCalledAt: number;
  /** 按执行顺序展示的阶段标题；未设置时沿用原有单行步骤链。 */
  stages?: readonly string[];
  steps: readonly WorkflowStep[];
};

export const WORKFLOWS: readonly Workflow[] = [
  // ── 做视频（A） ──────────────────────────────────────────────
  {
    id: "wf-short-video",
    zone: "general",
    tab: "A",
    title: "短视频全流程",
    purpose: "一条短视频从开场钩子到发布前审的完整顺序。",
    appliesTo: "做短视频、口播视频、出一条片子",
    calls: 50,
    lastCalledAt: 1762905600000,
    steps: [
      "hook-3s-script",
      "ai-storyboard-director",
      "seedance-motion-studio",
      "auto-editor",
      "caption-animation",
      "voice_generation",
      "prepublish-review",
    ],
  },
  {
    id: "wf-short-drama",
    zone: "general",
    tab: "A",
    title: "短剧生产线",
    purpose: "短剧从立项、写作、分镜到审查的生产线。",
    appliesTo: "做短剧、写短剧剧本、短剧分镜",
    calls: 40,
    lastCalledAt: 1762819200000,
    steps: [
      "short-drama-develop",
      "short-drama-write",
      "short-drama-storyboard",
      "short-drama-review",
    ],
  },
  {
    id: "wf-motion-video",
    zone: "general",
    tab: "A",
    title: "动效成片线",
    purpose: "用数学动画与动效做成片，并看完整回放验收。",
    appliesTo: "做动效视频、数学动画、讲解动画",
    calls: 30,
    lastCalledAt: 1762732800000,
    steps: ["manim-skill", "motion-design", "motion_replay_acceptance"],
  },
  {
    id: "wf-viral-remake",
    zone: "general",
    tab: "A",
    title: "爆款复刻线",
    purpose: "拆解爆款结构，复刻成带货分镜。",
    appliesTo: "复刻爆款视频、拆解带货视频",
    calls: 20,
    lastCalledAt: 1762646400000,
    steps: ["viral-remake", "selling-point-storyboard"],
  },
  {
    id: "wf-travel-video",
    zone: "general",
    tab: "A",
    title: "文旅宣传片线",
    purpose: "把旅拍照片做成文旅宣传片。",
    appliesTo: "做文旅宣传片、旅拍照片成片",
    calls: 10,
    lastCalledAt: 1762560000000,
    steps: ["travel-skill", "travel-photo-to-video"],
  },
  // ── 做图与视觉（B） ──────────────────────────────────────────
  {
    id: "wf-image-gen",
    zone: "general",
    tab: "B",
    title: "生图线",
    purpose: "写生图提示，并在已定版的图上只改指定部分。",
    appliesTo: "生图、改图、画一张图",
    calls: 30,
    lastCalledAt: 1762905600000,
    steps: ["visual-skills-image", "iterative_image_variants"],
  },
  {
    id: "wf-character",
    zone: "general",
    tab: "B",
    title: "角色设定线",
    purpose: "做角色设定，并让同一角色在多张图里保持一致。",
    appliesTo: "设计角色、角色三视图、保持角色一致",
    calls: 20,
    lastCalledAt: 1762819200000,
    steps: [
      "character-turnaround-studio",
      "genie-character-consistency",
      "scenario-consistency",
    ],
  },
  {
    id: "wf-3d-rebuild",
    zone: "general",
    tab: "B",
    title: "3D 重建线",
    purpose: "从参考图重建 3D 模型。",
    appliesTo: "把参考图做成 3D 模型、三视图建模",
    calls: 10,
    lastCalledAt: 1762732800000,
    steps: ["reference-to-3d", "orthographic-registration", "blender-mastery"],
  },
  // ── 做游戏与互动（C） ────────────────────────────────────────
  {
    id: "wf-game-build",
    zone: "general",
    tab: "C",
    title: "游戏制作线",
    purpose: "从设计、开发、引擎到手感与游戏界面的制作顺序。",
    appliesTo: "做游戏、开发小游戏、游戏界面",
    calls: 20,
    lastCalledAt: 1762905600000,
    steps: [
      "game-design-theory",
      "game-developer",
      "game-engine",
      "game-feel",
      "game-ui-design",
    ],
  },
  {
    id: "wf-rig",
    zone: "general",
    tab: "C",
    title: "骨骼角色线",
    purpose: "给角色绑骨骼，并验证各个角度关节都不脱开。",
    appliesTo: "角色骨骼绑定、骨骼动画准备",
    calls: 10,
    lastCalledAt: 1762819200000,
    steps: ["skeletal_rig_registration"],
  },
  // ── 做产品与 UI（D） ─────────────────────────────────────────
  {
    id: "wf-ui-production",
    zone: "general",
    tab: "D",
    title: "UI 生产线",
    purpose: "页面从形态、设计、文案到动效审查的七阶段生产线。",
    appliesTo: "做页面、改界面、做 UI",
    calls: 10,
    lastCalledAt: 1762905600000,
    steps: [
      "ui-production-flow",
      "frontend-design",
      "impeccable",
      "ux-writing",
      "emil-design-eng",
      "animate",
      "review-animations",
    ],
  },
  // ── 底层甲板（L0） ───────────────────────────────────────────
  {
    id: "wf-dispatch",
    zone: "general",
    tab: "L0",
    title: "AI 派工线",
    purpose: "把活派给其他执行方、跟进并收回执的顺序。",
    appliesTo: "派活给其他 AI、多方协作执行",
    calls: 20,
    lastCalledAt: 1762905600000,
    steps: ["ai_army_orchestration", "apc_agent_dispatch", "codex_local_ops"],
  },
  {
    id: "wf-desktop",
    zone: "general",
    tab: "L0",
    title: "电脑操作线",
    purpose: "操作电脑桌面软件与批量网页的执行顺序。",
    appliesTo: "操作电脑软件、批量处理网页",
    calls: 10,
    lastCalledAt: 1762819200000,
    steps: ["pc-desktop-ops", "mac_desktop_guided_assist", "agent-browser-local-ops"],
  },
  // ── 业务专属 · 公司业务组 ────────────────────────────────────
  {
    id: "wf-sales-inquiry",
    zone: "exclusive",
    tab: "company",
    title: "客户询盘线",
    purpose: "客户询盘先对接回复，再登记客户信息。",
    appliesTo: "处理客户询盘、登记新客户",
    calls: 10,
    lastCalledAt: 1762905600000,
    steps: ["sales-handoff", "customer-registration"],
  },
  {
    id: "qship-design",
    zone: "exclusive",
    tab: "company",
    title: "QShip 设计工作流",
    purpose: "QShip 页面从审核、设计定案到前端实现与真机验收的八阶段工作流。",
    appliesTo: "给 QShip 新页面定案、改版或换肤、诊断修复页面问题、定版维护全产品字阶/令牌/文案等设计资产；功能逻辑开发转开发线，非 QShip 页面不走本线",
    // 新线保序种子，非真实调用统计。
    calls: 0,
    lastCalledAt: 0,
    // 来源：qship-design-workflow/节点表.md v1.1、节点分工表.md。
    // 24 个源节点＋R1/R2 两席；5/20 为无 Skill 关口，不伪造引用。
    stages: ["页面审核", "功能精简", "排版", "UI", "交互", "文案", "前端实现", "审查验收"],
    steps: [
      // ① 页面审核
      { node: "1", title: "交互逻辑审查", stage: 1, skill: "design-review" },
      { node: "2", title: "困惑点盘点", stage: 1, skill: "cognitive-walkthrough" },
      { node: "3", title: "现有功能盘点", stage: 1, skill: "observe" },
      { node: "R1", title: "Gemini 异模型复审（审核阶段）", stage: 1, kind: "seat" },
      // ② 功能精简
      { node: "4", title: "功能取舍（只藏不阉）", stage: 2, skill: "distill" },
      { node: "5", title: "入口收敛", stage: 2, kind: "gate", note: "人工定案" },
      { node: "6", title: "命名统一", stage: 2, skill: "ux-writing" },
      // ③ 排版
      { node: "7", title: "信息架构", stage: 3, skill: "information-architecture" },
      { node: "8", title: "布局定案", stage: 3, skill: "design-screen" },
      { node: "9", title: "对标拆解", stage: 3, skill: "document" },
      { node: "9b", title: "QShip 风格定版", stage: 3, skill: "document" },
      { node: "10a", title: "字型选定", stage: 3, skill: "design-screen" },
      { node: "10b", title: "字阶定版", stage: 3, skill: "design-tokens" },
      { node: "10c", title: "散值稽核与迁移", stage: 3, skill: "typography-system" },
      // ④ UI
      { node: "11", title: "视觉定案", stage: 4, skill: "design-doctrine" },
      { node: "12", title: "空状态与示例", stage: 4, skill: "onboard" },
      // ⑤ 交互
      { node: "13", title: "动线设计", stage: 5, skill: "user-flow-diagram" },
      { node: "14", title: "状态反馈与动效", stage: 5, skill: "emil-design-eng" },
      // ⑥ 文案
      { node: "15", title: "清上游自带文案", stage: 6, skill: "ux-writing" },
      { node: "16", title: "本产品文案定稿", stage: 6, skill: "ux-writing" },
      // ⑦ 前端实现
      { node: "17a", title: "编码实现", stage: 7, skill: "design-code" },
      { node: "18", title: "真实浏览器自测", stage: 7, skill: "blackbox-tester" },
      // ⑧ 审查验收；stage 按执行顺序分组，保留 19 → R2 → 17b → 20。
      { node: "19", title: "对照审核清单复审", stage: 8, skill: "gate" },
      { node: "R2", title: "Gemini 异模型复审（验收阶段）", stage: 8, kind: "seat" },
      // 17b 源属⑦，但明确在 19 后、20 前执行，故展示归⑧并保留源归属副注。
      { node: "17b", title: "发布收口", stage: 8, skill: "ship", note: "源属⑦ 前端实现；在节点 19 后、20 前执行" },
      { node: "20", title: "真机验收", stage: 8, kind: "gate", note: "规矩关" },
    ],
  },
];

/** 通用区事件标签（一次只展开一个）。F 栏（原「做业务与运营」）已整栏
    迁入业务专属区，不再是通用标签。 */
export const GENERAL_TABS: ReadonlyArray<{ key: SkillColumn; title: string }> = [
  { key: "A", title: "做视频" },
  { key: "B", title: "做图与视觉" },
  { key: "C", title: "做游戏与互动" },
  { key: "D", title: "做产品与 UI" },
  { key: "E", title: "写内容与文档" },
  { key: "L0", title: "底层甲板" },
];

export const EXCLUSIVE_GROUPS: ReadonlyArray<{
  key: "company" | "personal";
  title: string;
}> = [
  { key: "company", title: "公司业务组" },
  { key: "personal", title: "个人自媒体组" },
];

/** 合并 Skill 的本体信息：这些 Skill 不单独建卡，本体挂在底层甲板的
    工具卡上（计数归属见 countTab）。图鉴里被工作流引用时渲染成引用卡，
    点击跳到宿主卡定位。描述为大白话一句话用途。 */
export type MergedSkillInfo = {
  desc: string;
  /** 调用次数（与 SKILL_CATALOG 同一套种子机制：现行顺序折算初值，
      真实累加待调度侧接线） */
  calls: number;
  hostProviderName: string;
  /** 计数归属标签：voice_generation 本体在底层、计数归做视频 */
  countTab: SkillColumn;
};

export const MERGED_SKILL_INFO: Readonly<Record<string, MergedSkillInfo>> = {
  voice_generation: {
    desc: "配音生成：让合成语音像真人说话",
    calls: 180,
    hostProviderName: "本地语音",
    countTab: "A",
  },
  codex_local_ops: {
    desc: "在本机调用代码执行引擎的操作规矩",
    calls: 190,
    hostProviderName: "Codex",
    countTab: "L0",
  },
  "pc-desktop-ops": {
    desc: "远程操作 Windows 电脑桌面软件",
    calls: 170,
    hostProviderName: "agent-desktop",
    countTab: "L0",
  },
  mac_desktop_guided_assist: {
    desc: "Mac 桌面软件的引导式操作协助",
    calls: 160,
    hostProviderName: "agent-desktop",
    countTab: "L0",
  },
  "agent-browser-local-ops": {
    desc: "在本机用浏览器自动化做批量网页操作",
    calls: 150,
    hostProviderName: "agent-browser",
    countTab: "L0",
  },
};

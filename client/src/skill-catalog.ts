// Generated from CLASSIFICATION.md §一 (2026-11-20), with SPEC.md §二 exclusions.
// Only independent skills live here; merged skills decorate existing server cards.
export type SkillColumn = "A" | "B" | "C" | "D" | "E" | "F" | "L0";

export type Skill = {
  name: string;
  desc: string;
  column: SkillColumn;
  sub: string;
  installed: boolean;
  /** 调用次数（排序用；初值按现行顺序折算保序，不是真实统计，
      真实累加靠调度侧后续接线） */
  calls: number;
  /** 最近调用时间戳（毫秒；初值同上，为保序折算值） */
  lastUsed: number;
};

export const SKILL_COLUMNS: ReadonlyArray<{ key: Exclude<SkillColumn, "L0">; title: string }> = [
  { key: "A", title: "做视频" },
  { key: "B", title: "做图与视觉" },
  { key: "C", title: "做游戏与互动" },
  { key: "D", title: "做产品与 UI" },
  { key: "E", title: "写内容与文档" },
  { key: "F", title: "做业务与运营" },
];

export const SKILL_CATALOG: readonly Skill[] = [
{"name": "ai_army_orchestration", "desc": "多 agent 编排：指挥/规格/派活/终审，写者≠验者路由表", "column": "L0", "sub": "AI派工编排", "installed": true, "calls": 120, "lastUsed": 1762905600000},
{"name": "apc_agent_dispatch", "desc": "经 AgentPeerChat 向其他 agent 派工/喂料/收回执", "column": "L0", "sub": "AI派工编排", "installed": true, "calls": 110, "lastUsed": 1762905540000},
{"name": "cli_login_preflight", "desc": "CLI 登录前先 dry-run/状态核查再向用户开口", "column": "L0", "sub": "登录预检", "installed": true, "calls": 100, "lastUsed": 1762905480000},
{"name": "codex_orchestration", "desc": "给 Codex 写可执行简报（前提/停续条件/验收数）", "column": "L0", "sub": "Codex/CLI调用", "installed": true, "calls": 90, "lastUsed": 1762905420000},
{"name": "feel-first-codex-brief", "desc": "给 Codex 的简报先定手感/观感，避免只按字面执行", "column": "L0", "sub": "Codex/CLI调用", "installed": true, "calls": 80, "lastUsed": 1762905360000},
{"name": "live_behaviour_verification", "desc": "真机行为验收：先写证据行再改、看可见变化", "column": "L0", "sub": "验收守望", "installed": true, "calls": 70, "lastUsed": 1762905300000},
{"name": "oss_candidate_evaluation", "desc": "开源候选评估审法（许可/入口/资源/维护成色）", "column": "L0", "sub": "选型", "installed": true, "calls": 60, "lastUsed": 1762905240000},
{"name": "product-manager-doctrine", "desc": "产品经理工作法：先查现成、规格先行、验收前置", "column": "L0", "sub": "产品决策·副D", "installed": true, "calls": 50, "lastUsed": 1762905180000},
{"name": "qship_patch_cycle", "desc": "QShip 补丁开发全周期（前提/源码核对/真机验收/部署）", "column": "L0", "sub": "系统维护", "installed": true, "calls": 40, "lastUsed": 1762905120000},
{"name": "server_disk_cleanup", "desc": "服务器磁盘清理：盘点/分级/核验后再删", "column": "L0", "sub": "系统维护", "installed": true, "calls": 30, "lastUsed": 1762905060000},
{"name": "verify_interactive_fix", "desc": "交互修复验收：先写证据行、看动作与可见变化", "column": "L0", "sub": "验收守望", "installed": true, "calls": 20, "lastUsed": 1762905000000},
{"name": "watchdog", "desc": "守望 cron：定时检查/自愈/只在状态变化时冒泡", "column": "L0", "sub": "验收守望", "installed": true, "calls": 10, "lastUsed": 1762904940000},
{"name": "action-fight-prompt", "desc": "动作打戏视频提示词设计（运镜/打击感/时序拆段）", "column": "A", "sub": "打戏子组", "installed": true, "calls": 520, "lastUsed": 1762905600000},
{"name": "adu-motion-video", "desc": "用动画工程包把口播文案+素材做成可编辑动效视频/60fps MP4", "column": "A", "sub": "动效成片", "installed": true, "calls": 510, "lastUsed": 1762905540000},
{"name": "ai-short-video-production", "desc": "AI短视频选题、口播脚本、分镜与发布复盘", "column": "A", "sub": "策划脚本", "installed": true, "calls": 500, "lastUsed": 1762905480000},
{"name": "ai-storyboard-director", "desc": "按剧本设计观看顺序/调度/摄影，分镜与视频提示词", "column": "A", "sub": "分镜导演", "installed": true, "calls": 490, "lastUsed": 1762905420000},
{"name": "auto-editor", "desc": "auto-editor CLI 剪视频/音频（去静默/黑帧、定节奏）", "column": "A", "sub": "剪辑", "installed": true, "calls": 480, "lastUsed": 1762905360000},
{"name": "auto-editor-effects", "desc": "auto-editor 给片段加动作/动画（变速/变焦/旋转等）", "column": "A", "sub": "剪辑特效", "installed": true, "calls": 470, "lastUsed": 1762905300000},
{"name": "auto-editor-export", "desc": "auto-editor 剪辑导出到达芬奇/Premiere等或单轨文件", "column": "A", "sub": "剪辑导出", "installed": true, "calls": 460, "lastUsed": 1762905240000},
{"name": "auto-editor-transcribe", "desc": "auto-editor whisper 转写并按口语内容剪辑", "column": "A", "sub": "转写·副E", "installed": true, "calls": 450, "lastUsed": 1762905180000},
{"name": "auto-editor-transitions", "desc": "在 auto-editor 切点加转场（交叉溶解/故障/翻页等）", "column": "A", "sub": "剪辑转场", "installed": true, "calls": 440, "lastUsed": 1762905120000},
{"name": "caption-animation", "desc": "动画字幕/TikTok卡拉OK式逐字字幕", "column": "A", "sub": "字幕花字", "installed": true, "calls": 430, "lastUsed": 1762905060000},
{"name": "chaojifeng-video-content-creator", "desc": "端到端口播/教程/产品视频创作（选题到成片审片）", "column": "A", "sub": "内容创作", "installed": true, "calls": 420, "lastUsed": 1762905000000},
{"name": "chaojifeng-video-design", "desc": "产品宣传/演示/知识讲解等视频设计与制作方法论", "column": "A", "sub": "视频设计", "installed": true, "calls": 410, "lastUsed": 1762904940000},
{"name": "code_animation_promo_production", "desc": "代码动画宣传片：先写节拍图再逐拍配画面", "column": "A", "sub": "代码动画", "installed": true, "calls": 400, "lastUsed": 1762904880000},
{"name": "countdown-video", "desc": "倒计时/直播开场倒计时动画视频", "column": "A", "sub": "模板视频", "installed": true, "calls": 390, "lastUsed": 1762904820000},
{"name": "creative-director", "desc": "创意导演：网站/动效视频/动态产品界面的设计与制作", "column": "A", "sub": "创意导演·副D", "installed": true, "calls": 380, "lastUsed": 1762904760000},
{"name": "director-agent", "desc": "编剧与导演处理：剧本创作/诊断、分镜前导演决策", "column": "A", "sub": "导演/剧本·副E", "installed": true, "calls": 370, "lastUsed": 1762904700000},
{"name": "douyin_ep_editing", "desc": "个人抖音 EP 系列的脚本/旁白/剪辑/发布规矩", "column": "A", "sub": "剪辑规矩", "installed": true, "calls": 360, "lastUsed": 1762904640000},
{"name": "emotion-performance-director", "desc": "真人 AI 视频角色的情绪表演提示词设计", "column": "A", "sub": "表演导演", "installed": true, "calls": 350, "lastUsed": 1762904580000},
{"name": "ffmpeg-video-editor", "desc": "FFmpeg 视频/音频编辑（裁剪/合成/处理全能）", "column": "A", "sub": "剪辑", "installed": true, "calls": 340, "lastUsed": 1762904520000},
{"name": "filmcraft", "desc": "以影视专业方式写/审/教剧本、镜头与制作", "column": "A", "sub": "影视专业·副E", "installed": true, "calls": 330, "lastUsed": 1762904460000},
{"name": "hook-3s-script", "desc": "电商短视频前3秒钩子（台词+画面+花字多版）", "column": "A", "sub": "钩子脚本·副F", "installed": true, "calls": 320, "lastUsed": 1762904400000},
{"name": "hook-writer", "desc": "各类社媒内容的开场钩子写作", "column": "A", "sub": "钩子脚本·副E", "installed": true, "calls": 310, "lastUsed": 1762904340000},
{"name": "iterative_video_shots", "desc": "按节拍逐镜生成视频、只重做失败镜", "column": "A", "sub": "迭代镜头", "installed": true, "calls": 300, "lastUsed": 1762904280000},
{"name": "jianying-editor", "desc": "剪映自动化剪辑 API（导入/字幕/动效/导出）", "column": "A", "sub": "剪辑", "installed": true, "calls": 290, "lastUsed": 1762904220000},
{"name": "lemo-opuscar", "desc": "全代码制作风格短片（油画/水彩/浮世绘等风格库）", "column": "A", "sub": "代码短片", "installed": true, "calls": 280, "lastUsed": 1762904160000},
{"name": "lower-thirds", "desc": "动画下三分之一标题条/姓名条", "column": "A", "sub": "字幕花字", "installed": true, "calls": 270, "lastUsed": 1762904100000},
{"name": "manim-composer", "desc": "Manim 解说视频的场景规划（写码前的构图）", "column": "A", "sub": "数学动画·规划", "installed": true, "calls": 260, "lastUsed": 1762904040000},
{"name": "manim-skill", "desc": "ManimCE 数学动画实现（带配音/字幕）", "column": "A", "sub": "数学动画·实现", "installed": true, "calls": 250, "lastUsed": 1762903980000},
{"name": "manimce-best-practices", "desc": "ManimCE 最佳实践规则库（场景/动画/LaTeX）", "column": "A", "sub": "数学动画·规范", "installed": true, "calls": 240, "lastUsed": 1762903920000},
{"name": "miora-video-studio", "desc": "miora 视频生成的可靠性/参数闸门/规格层", "column": "A", "sub": "视频生成", "installed": true, "calls": 230, "lastUsed": 1762903860000},
{"name": "motion-design", "desc": "全代码动效设计管线（发布片/宣传片/社媒视频）", "column": "A", "sub": "动效成片", "installed": true, "calls": 220, "lastUsed": 1762903800000},
{"name": "motion_replay_acceptance", "desc": "动效/打斗验收必须看完整回放逐段判好看与否", "column": "A", "sub": "动效验收·副L0", "installed": true, "calls": 210, "lastUsed": 1762903740000},
{"name": "prepublish-review", "desc": "短视频发布前敏感词/导流模式审核", "column": "A", "sub": "发布审核·副F", "installed": true, "calls": 200, "lastUsed": 1762903680000},
{"name": "scripting-and-storyboarding", "desc": "视频前期：双栏 AV 脚本与分镜决策文档", "column": "A", "sub": "策划分镜", "installed": true, "calls": 190, "lastUsed": 1762903620000},
{"name": "seedance-2.0", "desc": "Seedance 2.0 视频创作/优化/排障（多平台）", "column": "A", "sub": "视频生成", "installed": true, "calls": 180, "lastUsed": 1762903560000},
{"name": "seedance-motion-studio", "desc": "Seedance 2.0 专业视频的策划/提示/制作/审片", "column": "A", "sub": "视频生成", "installed": true, "calls": 170, "lastUsed": 1762903500000},
{"name": "selling-point-storyboard", "desc": "商品卖点拆成带货短视频逐镜分镜表+storyboard.json", "column": "A", "sub": "分镜·副F", "installed": true, "calls": 160, "lastUsed": 1762903440000},
{"name": "short-drama-develop", "desc": "短剧开发：小说/梗概整理成立项/大纲/导演阐述", "column": "A", "sub": "短剧子组", "installed": true, "calls": 150, "lastUsed": 1762903380000},
{"name": "short-drama-review", "desc": "短剧审查：剧本/视觉/分镜/提示词/成片审查", "column": "A", "sub": "短剧子组", "installed": true, "calls": 140, "lastUsed": 1762903320000},
{"name": "short-drama-storyboard", "desc": "短剧分镜：切镜/连戏/首尾帧提示词", "column": "A", "sub": "短剧子组", "installed": true, "calls": 130, "lastUsed": 1762903260000},
{"name": "short-form-video", "desc": "短视频（Reels/TikTok/Shorts）制作与模板", "column": "A", "sub": "短视频", "installed": true, "calls": 120, "lastUsed": 1762903200000},
{"name": "short-form-video-script", "desc": "竖版短视频脚本的完播 craft", "column": "A", "sub": "短视频脚本", "installed": true, "calls": 110, "lastUsed": 1762903140000},
{"name": "style-atlas", "desc": "代码视频风格图鉴：锁风格/查提示/去AI味审查", "column": "A", "sub": "风格锁定·副D", "installed": true, "calls": 100, "lastUsed": 1762903080000},
{"name": "subtitles-and-text-effects", "desc": "带货短视频字幕与花字（ASS/SRT、避安全区、烧录）", "column": "A", "sub": "字幕花字", "installed": true, "calls": 90, "lastUsed": 1762903020000},
{"name": "travel-photo-to-video", "desc": "旅拍照片做成文旅宣传片分镜+图生视频提示词", "column": "A", "sub": "文旅视频·副E", "installed": true, "calls": 80, "lastUsed": 1762902960000},
{"name": "travel-skill", "desc": "文旅宣传片导演：创意/分镜/运镜/生成提示全程", "column": "A", "sub": "文旅视频·副E", "installed": true, "calls": 70, "lastUsed": 1762902900000},
{"name": "video-edit-cli", "desc": "无头 video-edit-cli 剪辑/检查/转写/母带/打包", "column": "A", "sub": "剪辑", "installed": true, "calls": 60, "lastUsed": 1762902840000},
{"name": "video-editing-skill", "desc": "自然语言视频剪辑（跳剪/字幕/叠字/变速，ffmpeg+Whisper）", "column": "A", "sub": "剪辑", "installed": true, "calls": 50, "lastUsed": 1762902780000},
{"name": "videocaptioner", "desc": "视频字幕：转写/优化/翻译/烧录样式字幕", "column": "A", "sub": "字幕·副E", "installed": true, "calls": 40, "lastUsed": 1762902720000},
{"name": "viral-remake", "desc": "爆款带货视频拆解复刻（结构拆解+复刻分镜）", "column": "A", "sub": "爆款复刻·副F", "installed": true, "calls": 30, "lastUsed": 1762902660000},
{"name": "visual-skills-video", "desc": "AI 视频生成器提示词创作/审校/拆分（Seedance/Kling/Veo等）", "column": "A", "sub": "视频提示", "installed": true, "calls": 20, "lastUsed": 1762902600000},
{"name": "yuwen-publish-precheck", "desc": "国内自媒体发布前风险自审与保意改稿（抖音/小红书/视频号）", "column": "A", "sub": "发布审核·副F", "installed": true, "calls": 10, "lastUsed": 1762902540000},
{"name": "blender-mastery", "desc": "Blender 全能：建模/雕刻/绑定/动画/渲染/导出", "column": "B", "sub": "3D/Blender", "installed": false, "calls": 110, "lastUsed": 1762905600000},
{"name": "character-turnaround-studio", "desc": "角色三视图/转面/服装细节/角色规范生成", "column": "B", "sub": "角色三视图", "installed": false, "calls": 100, "lastUsed": 1762905540000},
{"name": "cinematic-asset-prompts", "desc": "从剧本提取角色/场景/道具的影视概念美术提示词", "column": "B", "sub": "视觉资产·副A", "installed": true, "calls": 90, "lastUsed": 1762905480000},
{"name": "genie-character-consistency", "desc": "多模态生图时保持复现角色的身份与风格一致", "column": "B", "sub": "角色一致性", "installed": false, "calls": 80, "lastUsed": 1762905420000},
{"name": "iterative_image_variants", "desc": "锁定已批基准、只改指定维度的迭代生图", "column": "B", "sub": "迭代改图", "installed": true, "calls": 70, "lastUsed": 1762905360000},
{"name": "orthographic-registration", "desc": "正交三/四视图对位到统一 Blender 坐标契约", "column": "B", "sub": "3D对位", "installed": false, "calls": 60, "lastUsed": 1762905300000},
{"name": "pixelfx", "desc": "代码像素特效与精灵动画库（244种现成效果）", "column": "B", "sub": "像素特效·副C", "installed": true, "calls": 50, "lastUsed": 1762905240000},
{"name": "reference-to-3d", "desc": "从参考图/三视图在 Blender 里重建 3D 模型", "column": "B", "sub": "3D重建", "installed": false, "calls": 40, "lastUsed": 1762905180000},
{"name": "reference_first_visual_prototype", "desc": "先锁定确切参考版本再做视觉原型", "column": "B", "sub": "视觉原型·副D", "installed": true, "calls": 30, "lastUsed": 1762905120000},
{"name": "scenario-consistency", "desc": "跨场景生成保持同一角色/造型/场景一致", "column": "B", "sub": "场景一致性", "installed": false, "calls": 20, "lastUsed": 1762905060000},
{"name": "visual-skills-image", "desc": "生图提示词（Nano Banana / GPT Image）模型/尺寸建议", "column": "B", "sub": "生图提示", "installed": true, "calls": 10, "lastUsed": 1762905000000},
{"name": "browser-playtest", "desc": "用 Playwright 真浏览器打开试玩/测试游戏", "column": "C", "sub": "试玩验收·副L0", "installed": true, "calls": 90, "lastUsed": 1762905600000},
{"name": "game-design-theory", "desc": "游戏设计理论（MDA/玩家心理/平衡/进程）", "column": "C", "sub": "游戏设计", "installed": true, "calls": 80, "lastUsed": 1762905540000},
{"name": "game-developer", "desc": "游戏开发：架构/ECS/物理/优化/状态机", "column": "C", "sub": "游戏开发", "installed": true, "calls": 70, "lastUsed": 1762905480000},
{"name": "game-engine", "desc": "2.5D Canvas 游戏循环与引擎架构", "column": "C", "sub": "游戏引擎", "installed": true, "calls": 60, "lastUsed": 1762905420000},
{"name": "game-feel", "desc": "游戏手感/juice（屏震/顿帧/补间/挤压拉伸）", "column": "C", "sub": "游戏手感", "installed": true, "calls": 50, "lastUsed": 1762905360000},
{"name": "game-ui-design", "desc": "游戏 UI 设计（清晰度/沉浸式界面/电竞可读性）", "column": "C", "sub": "游戏UI·副D", "installed": true, "calls": 40, "lastUsed": 1762905300000},
{"name": "game-ui-ux", "desc": "游戏 UI/UX：HUD/菜单/多分辨率适配", "column": "C", "sub": "游戏UI·副D", "installed": true, "calls": 30, "lastUsed": 1762905240000},
{"name": "skeletal_rig_registration", "desc": "骨骼角色绑定与验证（各角度关节不脱）", "column": "C", "sub": "骨骼绑定·副B", "installed": true, "calls": 20, "lastUsed": 1762905180000},
{"name": "threejs-game-ui-designer", "desc": "Three.js 游戏 UI（HUD/菜单/触控）借鉴版", "column": "C", "sub": "游戏UI·副D", "installed": true, "calls": 10, "lastUsed": 1762905120000},
{"name": "animate", "desc": "从零构建动画/动效决策（UI动效为主，Emil系）", "column": "D", "sub": "动效·副A", "installed": true, "calls": 90, "lastUsed": 1762905600000},
{"name": "emil-design-eng", "desc": "Emil 式 UI 打磨/组件/动画决策的设计工程哲学", "column": "D", "sub": "动效设计工程", "installed": true, "calls": 80, "lastUsed": 1762905540000},
{"name": "frontend-design", "desc": "新 UI 的视觉设计方向与前端设计指引", "column": "D", "sub": "UI设计", "installed": true, "calls": 70, "lastUsed": 1762905480000},
{"name": "impeccable", "desc": "现有前端的设计/改版/审校/打磨/动效", "column": "D", "sub": "UI改版打磨", "installed": true, "calls": 60, "lastUsed": 1762905420000},
{"name": "review-animations", "desc": "按高标准审查动画/动效代码（Emil系）", "column": "D", "sub": "动效审查·副A", "installed": true, "calls": 50, "lastUsed": 1762905360000},
{"name": "ui-production-flow", "desc": "UI 生产七阶段总路由（形态/设计/文案/实现/动效/审查/验收）", "column": "D", "sub": "UI生产流程", "installed": true, "calls": 40, "lastUsed": 1762905300000},
{"name": "ui-ux-pro-max", "desc": "UI/UX 设计智能库（配色/字体/界面模式查询）", "column": "D", "sub": "UI数据", "installed": true, "calls": 30, "lastUsed": 1762905240000},
{"name": "ux-copy", "desc": "UX 文案写作/审查（微文案/错误提示/CTA）", "column": "D", "sub": "UX文案", "installed": true, "calls": 20, "lastUsed": 1762905180000},
{"name": "ux-writing", "desc": "以用户为中心的界面文案规范与 tone 框架", "column": "D", "sub": "UX文案", "installed": true, "calls": 10, "lastUsed": 1762905120000},
{"name": "short-drama-write", "desc": "短剧写作：可拍摄单集剧本编写/修订/去AI味", "column": "E", "sub": "短剧写作·副A", "installed": true, "calls": 10, "lastUsed": 1762905600000},
{"name": "customer-registration", "desc": "客户获客登记：客户信息写入在线登记表", "column": "F", "sub": "公司业务", "installed": true, "calls": 60, "lastUsed": 1762905600000},
{"name": "douyin-personal-publishing", "desc": "个人抖音号发布全流程（检查单/代发/风控/处置）", "column": "F", "sub": "社媒发布·副A", "installed": true, "calls": 50, "lastUsed": 1762905540000},
{"name": "drone_news_digest", "desc": "无人机行业新闻日报：采集/成稿/审核后推企微群", "column": "F", "sub": "新闻日报", "installed": true, "calls": 40, "lastUsed": 1762905480000},
{"name": "company-geo", "desc": "自家品牌 GEO 全网自动化攻略（搜索/AI问答可见度）", "column": "F", "sub": "公司业务·GEO", "installed": true, "calls": 30, "lastUsed": 1762905420000},
{"name": "sales-handoff", "desc": "客户询盘对接：翻译/双语回复/转销售/登记信息", "column": "F", "sub": "公司业务", "installed": true, "calls": 20, "lastUsed": 1762905360000},
{"name": "wecom-unified", "desc": "企业微信全能套件（通讯录/文档/表格/日程/消息等）", "column": "F", "sub": "企业微信", "installed": true, "calls": 10, "lastUsed": 1762905300000},
];

// 合并条目的计数归属（定版口径：按条目数计，不按卡面张数）：合并 skill
// 不单独建卡、只挂宿主卡的「含 Skill」徽章，但计数归入它所属的栏。
// voice_generation 挂在底层甲板的「本地语音」卡上，计数归做视频栏（A）；
// 其余合并条目（agent-browser-local-ops / codex_local_ops / pc-desktop-ops /
// mac_desktop_guided_assist）同属底层甲板，其条目数已含在底层甲板现行
// 计数口径内（宿主卡＋L0 目录与条目数一致），不在此重复叠加。
export const MERGED_SKILLS_BY_COLUMN: Readonly<
  Partial<Record<SkillColumn, readonly string[]>>
> = {
  A: ["voice_generation"],
};

export const MERGED_SKILLS: Readonly<Record<string, readonly string[]>> = {
  "agent-browser": [
    "agent-browser-local-ops"
  ],
  "Codex": [
    "codex_local_ops"
  ],
  "agent-desktop": [
    "pc-desktop-ops",
    "mac_desktop_guided_assist"
  ],
  "本地语音": [
    "voice_generation"
  ]
};

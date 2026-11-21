# QShip 设计工作流登记与流程可视化现状报告

日期：2026-11-21。范围：`.`。

已新增 `qship-design`，登记在「业务专属 → 公司业务组」。这次是现有数据结构下的 Skill 顺序登记：事实源展开后有 **24 个主节点，投影为 22 个 Skill 步骤**；两个无 Skill 节点、R1/R2 复审席、阶段分组与人员分工仍不能完整进入现有图鉴结构。现状结论来自只读源码审查，未运行浏览器或宣称完成视觉验收。

## 1. 改动与事实来源

仅修改 [client/src/workflow-catalog.ts](client/src/workflow-catalog.ts)，在 `WORKFLOWS` 末尾新增一条数据；另新建本报告。没有修改类型、辅助函数、既有条目、Skill 目录、渲染组件、样式或服务端代码。未发布、未 push、未提交或更改 git 历史。

流程内容唯一事实源为以下三份已完整读取的文件，未用其他文档补造节点：

| 文件 | 本次用途 |
|---|---|
| [注册条目.md](custom-skills/qship-design-workflow/注册条目.md) | 名称、ID、适用与不适用范围、八阶段结构及前身关系 |
| [节点表.md](custom-skills/qship-design-workflow/节点表.md) | v1.1 节点、采用 Skill、显式执行顺序、复审席与无障碍深审 |
| [节点分工表.md](custom-skills/qship-design-workflow/节点分工表.md) | 节点到主责／复核／配合人员的映射，以及文档所载通道状态 |

登记字段：`id: "qship-design"`、`title: "QShip 设计工作流"`；`purpose` 用一句话描述审核、设计定案、前端实现、真机验收的八阶段全链路；`appliesTo` 改写为来活时可判读的说法，覆盖新页面、改版／换肤、页面诊断修复、全产品字阶／令牌／文案等设计资产，并保留「功能逻辑开发转开发线、非 QShip 页面不走本线」的边界。

## 2. zone/tab 与种子值

- `zone: "exclusive"`：注册条目明确限定 QShip，且排除其他产品页面，属于特定产品工作线。
- `tab: "company"`：既有专属区只有「公司业务组」与「个人自媒体组」（`workflow-catalog.ts:305`），现有「客户询盘线」也使用 `exclusive/company`。产品页面工作更贴近公司业务组，不属于个人自媒体；本次沿用既有分组，没有新建 QShip 标签。
- 通用区 `D` 虽名为「做产品与 UI」，但其现有 UI 生产线面向通用页面；这里优先保留本线的 QShip 专属边界。「公司业务组」是既有分类中的最贴近选择，不意味着事实源另有公司组织归属声明。
- `calls: 0`、`lastCalledAt: 0` 均为**新线保序种子，非真实统计**。前者不代表已经接入统计并观测到零调用；后者不是实际调用日期。现有同组客户询盘线为 `10 / 1762905600000`，因此新线排在它之后，不抢占原顺序。排序代码为 `App.tsx:2358` 的调用次数降序、同数按最近调用降序。
- 注册条目记载任命页试点，并不足以推算累计调用次数或最近调用时间，本次不据此造数。

## 3. 节点到 steps 的完整映射

登记口径：源明确主辅时取主项；明确「定点替换」且直接承担该节点任务时取替换专件；方法节点采用表内明示工具；其他并列项取首列 Skill。后两种属于本次单字段投影口径，**并非声称原表逐行都已明确指定唯一主 Skill**。辅助件、规则参考、实现／审查配件不另拆为步骤。

| 图鉴步号 | 源节点 | 源阶段 | 写入的主 Skill／处理 |
|---|---|---|---|
| 1 | 1 交互逻辑审查 | ① 页面审核 | `design-review` |
| 2 | 2 困惑点盘点 | ① 页面审核 | `cognitive-walkthrough` |
| 3 | 3 现有功能盘点 | ① 页面审核 | `observe` |
| 4 | 4 功能取舍 | ② 功能精简 | `distill`，取定点替换的减法专件 |
| — | 5 入口收敛 | ② 功能精简 | 源明确无专件、人工定案；只留注释，不伪造 Skill 名 |
| 5 | 6 命名统一 | ② 功能精简 | `ux-writing` |
| 6 | 7 信息架构 | ③ 排版 | `information-architecture`，源明确主项 |
| 7 | 8 布局定案 | ③ 排版 | `design-screen` |
| 8 | 9 对标拆解 | ③ 排版 | `document`，方法节点所用工具 |
| 9 | 9b QShip 风格定版 | ③ 排版 | `document`，方法节点首列工具 |
| 10 | 10a 字型选定 | ③ 排版 | `design-screen`，源明确用于真实页面拼样 |
| 11 | 10b 字阶定版 | ③ 排版 | `design-tokens` |
| 12 | 10c 散值稽核与迁移 | ③ 排版 | `typography-system`，稽核迁移专件 |
| 13 | 11 视觉定案 | ④ UI | `design-doctrine` |
| 14 | 12 空状态与示例 | ④ UI | `onboard`，取定点替换的空状态专件 |
| 15 | 13 动线设计 | ⑤ 交互 | `user-flow-diagram` |
| 16 | 14 状态反馈与动效 | ⑤ 交互 | `emil-design-eng`，取决策项 |
| 17 | 15 清上游自带文案 | ⑥ 文案 | `ux-writing` |
| 18 | 16 本产品文案定稿 | ⑥ 文案 | `ux-writing`，源明确主项 |
| 19 | 17a 编码实现 | ⑦ 前端实现 | `design-code` |
| 20 | 18 真实浏览器自测 | ⑦ 前端实现 | `blackbox-tester` |
| 21 | 19 对照审核清单复审 | ⑧ 审查验收 | `gate` |
| 22 | 17b 发布收口 | ⑦ 前端实现 | `ship`，按源明确要求放在 19 后、20 前 |
| — | 20 真机验收 | ⑧ 审查验收 | 源明确无 Skill、规矩关；只留注释，不伪造 Skill 名 |

24 个源节点的计算：原编号 1–20，加上节点 10 拆三项增加 2、节点 17 拆两项增加 1、9b 增加 1。八阶段各含 3、3、7、2、2、2、3、2 个主节点，总计 24；扣掉无 Skill 的 5/20，得到 22 个步骤、18 种不同 Skill。

R1 位于阶段①，R2 位于阶段⑧，两者是独立复审席，不是 Skill 步骤，没有塞入 `steps` 或 `branches`。无障碍深审主件是 `a11y-audit`（节点表第 81 行），但源没有指定挂在哪一主节点；本次不擅自挂到节点 19，也不把可选深审变成必经步骤，因此登记数据暂不使用 `branches`。这些信息保留在本报告与原事实源中。

源码注释保留八阶段与源节点号，便于维护者核对；注释不是运行时数据，页面仍只显示数组步号 1–22。

## 4. 现行流程可视化实现

### 4.1 文件、组件与数据流

| 文件／位置 | 当前职责 |
|---|---|
| `client/src/workflow-catalog.ts:9` | `Workflow`、`WorkflowStep`、注册表、分区标签、步骤／分支读取函数、合并 Skill 元信息 |
| `client/src/App.tsx:23` | 注册表唯一直接代码导入者 |
| `App.tsx:2015` 的 `SkillAtlas` | 技能图鉴；在 2073 行合并出厂工作流与服务端返回的用户工作流 |
| `App.tsx:2376` 的 `renderGeneralTab`、2533 行的 `renderExclusive` | 按分区、标签／组筛选、排序；专属区按既有两个组展示 |
| `App.tsx:2186` 的 `renderWorkflow` | 工作流头部、步骤序列、主链和分支 DOM；`WfNodeCard` 在 1450 行渲染每张节点卡 |
| `client/src/theme.css:1025` | 工作流容器、点阵背景、横滚、固定节点、CSS 连线；1280 行定义分支竖排，1432 行定义窄屏处理 |
| `App.tsx:1737` 的 `WorkflowBuilder` | 用户建流表单，编辑时是纵向步骤列表与分支标签；保存后仍由上述横向画布展示 |
| `client/src/skill-catalog.ts`、`workflow-catalog.ts` 的 `MERGED_SKILL_INFO` | 提供技能本体名称、简介与调用数；用户自加 Skill 在 `App.tsx:2068` 合入查找表 |

图鉴挂在 `App.tsx:3981` 附近的 `efficiency` 分类。注册表头部虽写「图鉴展示与调度判读共用」，本次全仓搜索只找到 `App.tsx` 的导入，未发现它已接入调度执行器的代码证据。

这里是 HTML／CSS 画布外观，并非通用流程图引擎；仓库中的 `@xyflow/react` 用在 [components/pump-diagram.tsx](client/src/components/pump-diagram.tsx) 的资源调度图，该组件不消费 `workflow-catalog.ts`。

### 4.2 一条工作流在图鉴里的样子

每条线有独立圆角边框容器。上部显示首字徽章、名称、用途、适用说法、「共 N 步 · 调用 X 次」，有分支时再显示分支数；下部为点阵背景与横向节点链（`App.tsx:2268`）。不同工作流纵向排列。

主链是**单行横向平铺**：`ol.wf-chain` 为 `display:flex; width:max-content`，没有换行；每张卡固定 **218×122px**，主步骤间有 32px 的 CSS 连线与箭头，节点不随数量缩小。超宽时由 `.wf-canvas-scroll { overflow-x:auto }` 在画布内横滚。窄屏只收紧内边距，不改成纵向或分阶段布局（`theme.css:1084`、1111、1139、1432）。

这次 22 个无分支步骤的链宽按 CSS 计算为 `22×218 + 21×32 = 5468px`，不含画布内边距；若 24 个源节点均可表达，则为 5968px。这是源码尺寸计算，不是浏览器测量。静态数组与渲染没有 20 步截断，问题是长链横滚与信息表达，不是静态容器最多只能放 20 步。

节点卡显示 Skill 首字徽章、Skill 名、目录中的通用简介，以及步号／分支／引用／专属／调用数等适用标签。名称和简介均两行截断（`theme.css:1226`），没有业务节点详情展开入口。同栏 Skill 显示本体卡，跨栏与合并 Skill 显示引用卡，可跳回本体；无法从工作流步骤单独指定该节点的名称或说明（`App.tsx:2201`）。

带分支时，主卡右侧多出一列同款卡，分支自上而下堆叠，用 CSS 竖脊、水平短线和箭头表现一对多。分支显示「分支」标签，不占主步号。下一主步骤的箭头排在整个「主卡＋分支列」之后；没有按边目标寻址的连线或显式汇合线（`App.tsx:2313`、`theme.css:1280`）。因此不能把这一形状直接解读成完整的并行／条件执行图。

### 4.3 20+ 节点、八阶段、复审席和人员会丢哪些信息

| 信息 | 当前能保留的部分 | 装不下或丢失的部分 |
|---|---|---|
| 长主链 | 静态 `steps` 可保存 20+ 项并完整遍历 | 无全链总览、阶段折叠或自动折行；本线需横滚浏览 |
| 八阶段 | 可写入总用途或源码注释 | 无 `stage` 字段、阶段标题容器、边界与归属；17b 归属⑦却在19后执行的关系也无法同时结构化表达 |
| 源节点身份 | 保存 Skill 名及数组顺序 | 没有独立 node ID、业务节点名、专属描述；9/9b 都变为 `document`，不能由卡片说明区分；源编号与「第 N 步」不同 |
| 无 Skill 关口 | 报告和注释可说明节点 5/20 | 类型没有人工决策／真机验收节点形态；填名字会被当作 Skill 引用，本次不造名 |
| R1/R2 两席 | 可在文字中提到其存在 | 无席位、盲审输入、独立报告、对照表、分歧处置、缺席／试行状态、命中率／误报率字段 |
| 节点→人 | 可在原节点分工表查阅 | 无主责、复核、配合、审批角色或泳道；如 17a Codex 编码／复核实例复核、19 复核实例主责＋R2＋统筹实例终审、9b/10a 用户 眼审均不会在图鉴中出现 |
| 输入／产出／证据 | Skill 通用简介仍可显示 | 无节点输入、交付物、证据链接、通过／阻塞、豁免与「缺证据不进下一节点」闸门，不能当执行状态机使用 |
| 主辅 Skill 与来源 | 一个主名可登记 | 辅件、参考件、定点替换层级、来源版本、同名包差异均丢失；例如底座和 gstack 的 `design-review` 只剩同一个字符串 |
| 全局设计资产 | 源9b可对应一项 `document` | 无「全局节点」标记、风格手册／样张／字阶令牌的跨页面复用关系、版本及依赖 |
| 可选深审与复审闭环 | 有挂点时可画一层分支 Skill 卡 | 无可选条件、回炉目标、汇合与循环；本次源未给 a11y 挂点，无法忠实落成拓扑 |
| 搜索后的流程 | 保留命中主节点的原数组步号 | 只按主 Skill 名／简介过滤，不查分支、用途或适用；仅标题命中可留下空链；剩余节点重新相邻连线，不能视为完整流程（`App.tsx:2193`、2313） |
| 反向参与关系 | 技能可显示第一次命中的流程／步号 | `reverseNoteFor` 首次匹配即返回，不能列全同技能参与的多个阶段／多个流程（`App.tsx:2164`） |

另需区分出厂数据与用户建流入口：静态 `Workflow.steps` 没有长度上限；`server/src/actions.ts:1534` 的新建接口和 1826 行的导入接口却最多接受 **20 个主步骤、每步 8 个分支**。本次 22 步静态登记不经过这两个接口，但同规模工作流通过现有用户新建／导入流程会受限。前端建流表单没有相应的 20 步添加上限提示。

## 5. WorkflowStep.branches 的能力边界

现有定义（`workflow-catalog.ts:15`）：

```ts
type WorkflowStep =
  | string
  | { skill: string; branches?: readonly string[] };
```

能表达一条有序主 Skill 链；任一主步骤可挂一层分支 Skill 名列表，列表顺序决定右侧竖排顺序。字符串简写等价于没有分支的主技能，`stepSkillName`／`stepBranches` 统一读取；`workflowSkillNames` 依次提取「主 Skill、其分支、下一主 Skill、其分支」，用于技能参与关系和零散工具排除，不是执行拓扑算法。静态类型对主步骤数和分支数均未设上限，前述用户接口另有限额。

不能表达分支内多步骤路径、递归分支、边的目标节点、条件／路径标签、互斥或并行语义、可选／必做、等待全部完成、汇合、多前驱依赖、回退／循环，也没有阶段与人／席位字段。给 `branches` 填 R1/R2 或人名只会得到同名 Skill 引用，并不会创建复审席或人员分工。把辅助 Skill 放进分支也会改变呈现含义，无法标明「辅助／参考」关系。

## 6. 对不上的地方与保留限制

1. **版本与节点总数不同步。** 注册条目第 7 行是 v1.0.0，第 11 行仍写「20 节点」；节点表第 1–3 行是 v1.1，已拆分10与17并增加9b。本次按节点明细登记，报告保留24源节点／22Skill步的明确口径，不回改事实源。
2. **源没有逐节点唯一主 Skill 列。** 多行并列底座、替换件、辅件或方法工具。上文逐项披露本次取值；尤其9b是拼用方法节点，10a的 `design-screen` 是拼样工具。节点5/20则明确没有 Skill，不能假装满足「每节点一个Skill」；其必经关口仍属于完整工作流。
3. **17b 的表格位置不等于执行位置。** 节点表第67行排在17a旁，但文字明定在19之后、20之前；本次据此登记为 `design-code → blackbox-tester → gate → ship`，R2的复审约束保留在事实源，未改成额外步骤。
4. **节点20名称与职责冲突。** 节点表第79行是「真机验收／用户眼审」，节点分工表第28行却写「上线复盘／统筹实例主责」。本次流程含义沿节点表，不凭分工表造复盘步骤；两者需要后续事实源维护时对齐。
5. **Gemini通道状态不同步。** 节点表第78行记全断、两席缺席；节点分工表第38–40行记大谷子API已修通、R1实跑、席位在席，注册条目第15行也记R1已补跑。这里仅报告文档差异，未重测通道，不把旧「全断」或新的「建议转正」写成注册数据的运行结论；建议转正也不等于已经转正。分工表另外列出的全套链A/F段并非节点表八阶段中的新增节点，本次不另扩链。
6. **官方 design-critique 的借件说法有后续收口。** 节点表第13行列其框架参考，第19行明确「不装、严重度表述作参考」。本次节点1取 `design-review`，没有额外登记 `design-critique`。
7. **前身路由仍宽泛。** 注册条目第14行说本线取代 QShip 场景的 `ui_production_flow`，现图鉴通用区「UI生产线」仍是「做页面、改界面、做UI」，技能名写作 `ui-production-flow`。现行结构没有替代／优先级字段，本次只在新线 `appliesTo` 写明边界，未越界重写前身条目；通用说法与专属说法仍有重叠。
8. **Skill目录未同步，不等于未安装。** 22步涉及18种Skill，现有出厂目录仅有 `ux-writing`（`skill-catalog.ts:120`，出现3次）和 `emil-design-eng`（113行，出现1次）。其余16种均不在 `SKILL_CATALOG` 或 `MERGED_SKILL_INFO`：`design-review`、`cognitive-walkthrough`、`observe`、`distill`、`information-architecture`、`design-screen`、`document`、`design-tokens`、`typography-system`、`design-doctrine`、`onboard`、`user-flow-diagram`、`design-code`、`blackbox-tester`、`gate`、`ship`。若用户层没有同名补齐，**18/22个步骤会显示「条目已删除」**，点击是空操作（`App.tsx:2253`）；这只是缺失查找的既有兜底文案，不证明这些技能曾被删除或未安装。已登记的4个步骤在本线中为跨区引用，可跳回通用D栏。本次不扩改Skill目录。
9. **重复Skill撞渲染key。** 本线 `ux-writing`×3、`document`×2、`design-screen`×2，业务上各对应不同源节点，不能为了去重而改名或合并。现行主节点key是 `wf.id + name`（`App.tsx:2314`），缺少节点ID／步号，因而这些兄弟节点key相同；属于确定的标识冲突，具体运行表现未作浏览器验证。本体卡的 `skill-body-${name}` ID 也缺少节点身份，重复本体会有定位歧义；本线这几种重复名当前为引用／缺失回退，不能把通用ID风险误称为本线已出现重复本体ID。
10. **注释／样式不完全等于实际状态。** `WfNodeCard` 注释和CSS包含点亮／待装口径，但现组件参数与class拼接（`App.tsx:1450`、1495）没有安装状态，实际只区分本体／引用及高亮；不能仅据CSS断言节点已正确显示安装状态，更不能把调用数当作节点完成进度。

这些都是本次登记与源码审查发现的限制，未实施渲染改造、结构扩展或后续方案定案。

## 7. 校验结果

先读取 `package.json`，仅运行已有检查／构建脚本：

| 命令 | 实际结果 |
|---|---|
| `bun run typecheck` | **通过，退出码0**；执行client与server两份 `tsc --noEmit` |
| `bun run build` | **未通过，退出码1**；服务端打包成功（191个模块），随后客户端被SDK手动构建保护拦截 |

构建阻断发生于 `client/build.mjs` 调用的 `node_modules/@hatch/space-sdk/dist/build.js`：当前环境不满足SDK构建驱动条件，报错 `This web artifact cannot be built by hand.`。工具提示的替代流程会自动重新发布，与本次「不发布」红线冲突，因此没有调用发布工具、修改SDK保护或设置绕过变量；这不是本次数据的TypeScript错误，也不能记作完整构建通过。服务端构建产物在工作树内且受 `.gitignore` 忽略；类型检查生成的两份未忽略缓存 `client/.tsbuildinfo.client`、`server/.tsbuildinfo.server` 已清理，未修改忽略规则。

只读导入数据核对：`qship-design` 恰好一条，22步／18种Skill，缺目录18步／16种Skill；同组排序为客户询盘线在前、QShip线在后。`git diff --check` 通过。最终 `git status --short` 仅列出修改的 `client/src/workflow-catalog.ts` 与新增的 `WORKFLOW-REGISTRATION-REPORT.md`。映射与渲染现状另经两个独立只读子任务交叉核对；实际检查结果以上述命令为准。

## v1 可视化改造

日期：2026-11-21。执行依据：`brief-codex-lootdeck-viz-v1.md`。本节追加记录本轮结果，前文保留为上一轮历史快照；前文关于「未扩展结构／未改渲染／未补登」的描述不再代表本轮状态。

### 改动文件与范围

| 文件 | 本轮改动 |
|---|---|
| `client/src/workflow-catalog.ts` | 兼容扩展步骤、阶段字段；QShip 登记为 24 个源节点＋R1/R2，共 26 项；无 Skill 步骤不计入技能引用列表 |
| `client/src/App.tsx` | 有阶段数据时分组展示；业务标题与技能副行；关口卡、复审席窄条、未登记弱标；步骤与分支 key 使用原步序；搜索纳入节点标题、编号、副注和阶段名 |
| `client/src/theme.css` | 仅新增阶段、关口、席位和未登记样式；阶段块纵向堆叠、块内 flex-wrap；原有 CSS 声明未修改 |
| `client/src/skill-catalog.ts` | 新增 12 条有源可查的出厂 Skill；新增可选来源字段；原有 100 条及顺序保持不变 |
| `WORKFLOW-REGISTRATION-REPORT.md` | 追加本节，登记来源、校验和未做项 |

仅修改本工作树；未发布、未 push、未提交或改写 git 历史，未更改 SDK、依赖、构建配置、服务端接口或事实源文件。复用既有 `WfNodeCard`、画布、色彩与间距变量，不引入新的流程图库。`App.tsx` 原本已超过 600 行，`renderWorkflow` 原本已超过 100 行；本轮保留局部改动以避免扩大旧工作流回归面，没有为行数预算重构整份应用。

### 结构字段与执行顺序

`WorkflowStep` 仍接受字符串和原有 `{ skill, branches? }` 对象。对象形态新增：

| 字段 | 类型与语义 |
|---|---|
| `node?` | `string`，源节点号，如 `9b`、`17a`、`R1` |
| `title?` | `string`，业务节点名，作为主标题 |
| `stage?` | `number`，从 1 起的展示／执行阶段；QShip 使用 1–8 |
| `kind?` | `"skill" \| "gate" \| "seat"`；缺省为 Skill。Skill 步仍要求 `skill: string`；gate/seat 可省略 `skill` |
| `note?` | `string`，关口副注或需要保留的源归属说明 |
| `branches?` | 原有 `readonly string[]`，保持原义 |

`Workflow.stages?: readonly string[]` 按序存阶段标题，用 `stage - 1` 索引。选择数组是因为本轮只需要八个标题，不需要新增阶段实体或改动服务端模型。`stepSkillName` 对无 Skill 的关口／席位返回空串，`workflowSkillNames` 跳过空主名并保留原有分支顺序。

QShip 阶段标题逐字采用当前节点表：页面审核、功能精简、排版、UI、交互、文案、前端实现、审查验收。展示顺序如下：

| 阶段 | 节点顺序 |
|---|---|
| ① 页面审核 | 1 → 2 → 3 → R1 |
| ② 功能精简 | 4 → 5 → 6 |
| ③ 排版 | 7 → 8 → 9 → 9b → 10a → 10b → 10c |
| ④ UI | 11 → 12 |
| ⑤ 交互 | 13 → 14 |
| ⑥ 文案 | 15 → 16 |
| ⑦ 前端实现 | 17a → 18 |
| ⑧ 审查验收 | 19 → R2 → 17b → 20 |

**17b 的源归属与执行分组分开说明：**源节点表把它归在⑦，但明确要求在 19 后、20 前执行。因此 `stage: 8` 表示它的展示／执行分组，卡面副注与源码注释保留「源属⑦ 前端实现；在节点 19 后、20 前执行」。没有把发布收口提前到浏览器自测或复审之前。

5／20 为不引用 Skill 的 `gate`，标题分别为「入口收敛」「真机验收」，副注分别为「人工定案」「规矩关」；`R1`／`R2` 为不引用 Skill 的 `seat`。仍为 22 个 Skill 步骤、18 种不同 Skill，原 22 个技能引用的相对顺序未变。工作流与新增目录条目的 0 值均保留／注明种子口径，不是已采集到的真实调用统计。

当前事实源已与旧报告第 6 节第 4／5 项所述状态不同：节点分工表的 20 现为「真机验收」，两份文件现均记载 Gemini 席在席及大谷子通道可用。这里只记录本轮读取到的文档内容，没有重测模型通道或把记载转成运行统计。

### 渲染兼容与补登结果

阶段检测以步骤的 `stage` 数据为准；无阶段数据仍使用原单行画布与链结构。有阶段数据按步骤顺序形成连续阶段块，块内换行；不会为了按阶段排序而重排步骤。阶段卡可随标题与副注增高，关口使用虚线边框和「关口」标，席位是独立窄条。步骤 key 为 `wf.id + 原始 index`，分支再加原分支 index，重复 `ux-writing`／`document`／`design-screen` 不再撞 key，搜索后也保留原始索引。

「目录未登记」兜底仅在工作流节点查找失败时使用，显示原 Skill 名，不再呈现「条目已删除」或虚假的跳转操作；技能图鉴本体与服务端删除行为未改。所有新增样式只面向阶段容器或新节点类别，旧单行工作流的 CSS 声明保持原样。

本轮查验 `base-skills/` 与 `parts/` 下 **682 个 `SKILL.md` 路径**，包含隐藏目录与符号链接。16 个待补名中，12 个有对应来源。名称逐字取自文件的 `name`；简介取自各自 `description` 的一个完整句子：`ship` 用第二句，其余用第一句，不自拟或翻译简介。下表路径相对 `custom-skills/qship-design-workflow/`：

| 已补登 Skill | 来源 |
|---|---|
| `design-review` | `base-skills/design-review/SKILL.md` |
| `cognitive-walkthrough` | `parts/mastepanoski-claude-skills/skills/cognitive-walkthrough/SKILL.md` |
| `observe` | `base-skills/observe/SKILL.md` |
| `information-architecture` | `parts/designer-skills/ux-strategy/skills/information-architecture/SKILL.md` |
| `design-screen` | `base-skills/design-screen/SKILL.md` |
| `design-tokens` | `base-skills/design-tokens/SKILL.md` |
| `typography-system` | `parts/vibe-building-skills/skills/frontend-design/typography-system/SKILL.md` |
| `design-doctrine` | `base-skills/design-doctrine/SKILL.md` |
| `user-flow-diagram` | `parts/designer-skills/prototyping-testing/skills/user-flow-diagram/SKILL.md` |
| `design-code` | `base-skills/design-code/SKILL.md` |
| `gate` | `base-skills/gate/SKILL.md` |
| `ship` | `base-skills/ship/SKILL.md` |

同名候选按节点表的来源归属选择，未将 gstack 的同名 `design-review`／`ship` 或其他 IA／走查包混入底座和指定借件。原出厂 `Skill` 没有来源字段，本轮沿用既有用户条目的命名增加可选 `sourceType`／`sourcePath`；新增项写入 `sourceType: "bundled"` 与完整来源文件路径。12 条归入现有 D 栏，`installed: false` 是未验证安装时的保守值，不能据此断言各 agent 未安装；未执行安装或探测外部 agent 环境。

**未补登 4 项：**`distill`、`document`、`onboard`、`blackbox-tester`。上述指定目录的完整扫描及 frontmatter 名称检索均未找到对应 `SKILL.md`，不使用别处同名文档、节点表用途或人工简介替代。因此 5 个步骤仍显示「目录未登记」：节点 4、9、9b、12、18（`document` 占两步）。目录总数由 100 增至 112。

### 验证与构建结果

| 检查 | 实际结果 |
|---|---|
| `bun run typecheck` | **通过，退出码 0**；client 与 server 的 `tsc --noEmit` 均完成 |
| `bun run build` | **整体退出码 1**；服务端打包成功，191 个模块，`actions.js` 258.91 KB；客户端被 SDK 拦截 |
| SDK 客户端构建 | 错误为 `This web artifact cannot be built by hand.`；未设置绕过变量、改保护或调用会自动重新发布的替代工具 |
| 旧数据回归 | 原 14 条工作流完整数据与 git HEAD 深度一致；原 100 条目录数据及顺序一致 |
| 旧渲染回归 | 从 git HEAD 与当前 `App.tsx` 提取实际渲染函数，内存中运行 React 静态渲染；14 条旧线 × 5 个搜索条件共 **70 次 HTML 逐字一致**，另有一个含重复 Skill 与分支的旧对象形态用例一致 |
| 新渲染／数据核对 | 26 项、8 块、2 关口、2 席位、26 个唯一原步序 key；标题、顺序、副注、5 处未登记标记正确；4 个搜索场景保留对应原索引；无 Skill 步骤未进入技能引用列表 |
| 来源独立复核 | 12 条名称、单句简介与来源逐项一致；来源路径存在；复核者未参与目录写入 |
| `git diff --check` | 通过 |
| 工作树范围 | `git status --short` 仅有上表 5 个任务文件；检查生成的 `client/.tsbuildinfo.client` 与 `server/.tsbuildinfo.server` 已清理；服务端构建产物受既有忽略规则覆盖 |

静态渲染核验是直接测试源码函数，没有生成客户端 bundle，不是浏览器截图或像素验收。代码与 HTML 的兼容性已验，**实际浏览器的三档截图、换行／无横滚与旧线像素一致性未验**；不将源码推断写成视觉实测结论。

本轮阶段与 skill：形态沿用执行简报；`ui_production_flow` 路由；已有页面实现采用 `impeccable` 的 layout／craft-floor（复用现有 token 与组件、样式限定新分支）；文案用 `ux-writing`＋中文附则核对业务标题、关口与未登记提示。无新增动效。实现后完成来源、结构与静态渲染检查，真浏览器／真机阶段未执行。

### 未做项

- 4 个缺少指定来源 `SKILL.md` 的目录项未补登，原因与受影响节点见上。
- 客户端完整构建及浏览器／真实客户端视觉验收未完成；本轮遵守 SDK 构建保护与不发布红线。
- 服务端新建／导入工作流的 **20 个主步骤、每步 8 个分支上限**未改，仍不支持经这些接口创建／导入本条 26 项静态工作流。阶段／关口／席位的用户建流和导入导出支持不在本轮范围。
- 未发布、未 push；未接入真实调用统计、人员分工、执行状态、证据采集或模型通道验证。

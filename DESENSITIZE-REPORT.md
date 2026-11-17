# 脱敏检查报告（2026-11-17，第五版导出，推送前）

导出物：Muse Space「战利品甲板」（slug: yang-mao-token-chi）当前版（v50）源码快照，
覆盖第四版（v48）导出物。本版新增：手机泵图图框高度修复——紧凑版容器高度
按图面纯宽高比折算（去掉旧公式给宽高各加的固定修正量，fitView 的比例
padding 下横竖缩放恰好一致、图面四边只剩边距不留空白带）；ResizeObserver
改为对宽、高任一变化都防抖重 fit（旧版只盯宽度，「宽度已定、高度随后落位」
那一步被漏掉，fit 停在挂载初期的临时视图上、图只占面板上部约四成，下方
留大片空白——第四版导出复核时实证、本版修复）。
前版内容沿用：补给泵图窄屏紧凑竖排布局（容器宽 <720px 时服务器每行 2 台、
水源每行 3 家多行排布、双指捏合缩放开放细看）、手机端卡墙 3 列、甲板主题
下手机端卡下文字预留行高收紧、示例/本人自动切换与 39 家目录、泵图服务器
状态面板（状态在上、业务在下）与无缝平铺海浪、Font Awesome 云形节点
（页脚署名保留）、Floating UI 详情弹框统一锚定定位、各板块内图鉴序号各自
从 1 重新编。
原则：全量打包源码与素材，脱敏只替换数据值，不删代码与素材；发布版只带
示例数据与示例状态逻辑。本报告只写处理类别，不复述被清除的具体值。

## 已替换/清除的数据值

| 位置 | 处理 |
|---|---|
| `server/src/actions.ts` CATALOG（39 家） | 全部条目的 `litStatus`（真实点亮状态）已剥离；魔搭条目的 `taskSeedDoneDay`（真实处理日期）与 `taskCycle` 种子已剥离；Kaggle、Scrapling、AWS 条目的个人备注已剥离 |
| `server/src/actions.ts` CATALOG · 示例专属条目 | 作者本人的两张服务器卡（云电脑、海外小机——含实例名、机型、个人持有状态与到期日）整条删除，替换为两张中性示例卡「示例云电脑」「示例海外服务器」（`demoOnly`），示例状态机制原样保留、演示数据为虚构示例，目录总数保持 39 |
| `server/src/actions.ts` SEED | OpenRouter 行的真实 key 尾号、含旧账号/旧 key 情况的 `conditionText`、指向个人服务器的备注已清除，状态改回 `unclaimed`；魔搭行 `taskLastDoneAt`（真实日期）改 `null`；火山方舟行文案改中性口径、备注清空 |
| `server/src/actions.ts` CATALOG 文案 | 涉及个人账号状态的表述已中性化：Codex 条目的个人账号归属与助手名、AWS/Google Cloud/Groq/Kaggle/Codespaces 条目改用公开版文案（源码中原有的 `publicQuota`/`publicContent` 即为此设，导出时折进主文案并去掉个人版，含 AWS 条目正文中的账号 ID、服务器 IP、注册邮箱与海外地址）、Google Cloud 与 AWS 的个人到期日改回通用周期口径、甲骨文条目的个人注册经历、共享记忆库与本地语音条目中的个人项目指涉、目录头注释中的个人事项变更记录 |
| `client/src/App.tsx` | key 尾号输入框占位示例改为通用示例；提效工具分区描述中的助手专名已中性化；个人服务器卡的品牌色块/Logo 登记随卡片一并移除，换成两张示例卡登记；Floating UI 定位与板块内序号逻辑原样保留 |
| `server/src/actions.ts` PUMP_SERVERS + `getPumpServers` | 泵图真实服务器清单只存服务端、仅本人状态经动作下发（客户端代码不含清单）；发布版服务端内置清单已整体替换为与客户端示例节点相同的虚构示例清单 |
| `client/src/components/pump-diagram.tsx` | 泵图服务器节点由真实服务器名与业务标签（个人业务系统名、站点名、助手驻留信息、真实到期日与月费）改为示例名与通用标签：腾讯云·云服务器 / 香港·云服务器 / Kaggle·免费 GPU / GitHub Codespaces / 云电脑（示例）/ 海外云服务器（示例）/ 云服务器（示例）；状态面板新版式（面板在上、语义色圆点）与 Font Awesome 云形、无缝海浪原样保留；文件头与 SERVERS 注释中的个人事项记录已改写为示例口径；本版的图框高度修复为纯布局代码（紧凑版高度折算公式、ResizeObserver 宽高双监听与防抖重 fit），与当前 Space 源码逐行比对确认差异仅此功能、该文件不含任何数据值 |
| `client/src/theme.css` | 第四版新增的两段窄屏样式（卡墙 3 列、卡下文字预留行高收紧）为纯样式规则，本版未变，不含任何数据值 |
| `server/src/schema.ts` | 注释中对看板主人的称谓已中性化 |
| 台账数据库 | 真实 `app.db` 未进仓（`.gitignore` 排除）；`data.example/providers.example.json` 已按脱敏后的 CATALOG 重新生成（39 家，状态全为示例值 `unclaimed`、尾号/备注为空、处理时间为 `null`） |
| README / data.example 说明 | 家数更新为 39；示例专属卡更新为两张；示例状态（board_mode）说明沿用：全新安装从示例状态起步、添置第一件自己的战利品后自动翻转清场 |

## 全仓扫描结论（grep，导出后实测；第五版已对全仓源码目录重新复核一遍）

- API key / 令牌模式（`sk-…`、池令牌、Bearer 值）：**0 命中**
- 个人邮箱（gmail/qq/outlook 等）/ 手机号模式：**0 命中**（drizzle 迁移 journal 的时间戳为构建元数据，非个人信息）
- 个人标识（法定姓名、邮箱前缀、真实 key 尾号、个人服务器实例名、云电脑产品/账号名、助手专名、个人业务系统与站点名、各服务器的 IP、云厂商账号 ID、个人到期日）：**0 命中**
- 真实领取记录（litStatus 数据值、taskLastDoneAt/taskSeedDoneDay 日期值、个人到期日）：**0 命中**（源码中仅保留机制本身的字段名与逻辑，无数据值）
- IPv4 模式扫描的命中均为 Logo SVG 的路径坐标数字，非 IP 地址。
- 保留的公开标识：GitHub 组织名 QS-qusheng 与 QShip 项目名、QShip 公开口号中的「船长」角色词——本仓库即该组织下的公开项目（见 README 与 LICENSE），属项目身份、非个人账号信息。

## 构建校验

- 导出物 `bun install` 后 `bun run typecheck`（client + server）：**通过**（第五版复跑实测）。
- 服务端动作构建（`build:server`）：**通过**（第五版复跑实测，产物已清、不进仓）；客户端 bundle 由 Muse Space 运行时构建（与前几版相同）。

## 截图说明

`docs/screenshots/` 三张仍为首版导出物在本地以演示数据渲染的截图（无任何真实
台账数据）；其后各版界面新增示例状态横幅、泵图状态面板、窄屏紧凑布局与
图框高度修复等，截图未随版重截，推送前可按需用本版导出物重新渲染替换。

## 未进仓文件（说明）

- `app.db` 等运行时数据、构建产物（dist）、`node_modules`、审计记录（audits/）：运行时/构建文件，非源码。
- `DATA-PLAN.md`、`AGENTS.md`：原 Space 的内部构建规划与施工说明文档，非产品代码与素材，未进仓。

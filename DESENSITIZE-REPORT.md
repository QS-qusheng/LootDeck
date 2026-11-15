# 脱敏检查报告（2026-11-15，推送前）

导出物：Muse Space「战利品甲板」（slug: yang-mao-token-chi）最终版（v31）源码快照。
原则：全量打包源码与素材，脱敏只替换数据值，不删代码与素材。

## 已替换/清除的数据值

| 位置 | 处理 |
|---|---|
| `server/src/actions.ts` CATALOG（36 家） | 全部条目的 `litStatus`（真实点亮状态）已剥离；魔搭条目的 `taskSeedDoneDay: "2026-11-15"`（真实处理日期）已剥离；Kaggle 的个人备注已剥离 |
| `server/src/actions.ts` SEED | OpenRouter 行的真实 key 尾号（cb26）、含旧账号/旧 key 情况的 `conditionText`、个人备注已清除，状态改回 `unclaimed`；魔搭行 `taskLastDoneAt`（2026-11-15）改 `null` |
| `client/src/App.tsx` | key 尾号输入框占位示例由真实尾号改为通用示例 `ab12`；提效工具分区描述中的个人称呼已中性化 |
| `client/src/components/pump-diagram.tsx` | 泵图服务器节点由真实服务器名（腾讯云·RAYI / 香港·QShip/归元）改为示例名（腾讯云·云服务器 / 香港·云服务器） |
| CATALOG 文案 | 涉及个人账号状态的表述已中性化（如「你是老号」→「老号领不了」、「赠金已在手」→「可领试用赠金」、Codex 条目的个人账号说明、甲骨文条目的个人注册经历） |
| 台账数据库 | 真实 `app.db` 未进仓（`.gitignore` 排除）；改为 `data.example/` 模板 + 演示数据（状态全为示例值） |
| 主题 | 导出物锁定甲板主题为唯一呈现：已移除主题开关按钮（原 Space 内开关与素版未动） |

## 全仓扫描结论（grep，推送前实测）

- API key / 令牌模式（`sk-…`、`hsurr:`、池令牌、Bearer 值）：**0 命中**
- 个人邮箱（gmail/qq 等）/ 手机号模式：**0 命中**（drizzle 迁移 journal 的时间戳为构建元数据，非个人信息）
- 个人标识（法定姓名、邮箱前缀、真实 key 尾号 cb26、RAYI、归元）：**0 命中**
- 真实领取记录（litStatus 数据值、taskLastDoneAt 日期值）：**0 命中**

## 截图同源验证

README 三张截图（docs/screenshots/）全部由**本导出物**在本地以演示数据跑起来后截取
（本地 harness 调用导出物自身的服务端动作 + 导出目录种子数据，演示点亮 17 家为示例值），
未使用原 Space 的任何截图。逐项对照：布局（泵图→战令→左榜→四分区）、主题开启态
（奶油底、2.5D 卡片、无主题开关）、补给泵图（云朵节点、水柱、圆形角标、示例服务器名）、
卡片角标（圆形数字角标、无对号）、战令（Lv.17 = 演示点亮数/36）——均与导出物实际渲染一致。

## 未进仓文件（说明）

- `app.db` 等运行时数据、构建产物（dist）、`node_modules`、审计记录（audits/）：运行时/构建文件，非源码。
- `DATA-PLAN.md`、`AGENTS.md`：原 Space 的内部构建规划与施工说明文档，非产品代码与素材，未进仓。

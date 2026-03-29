# 鬼王区 / 鬼王牌库 — 状态机与协议（定稿备忘）

> **版本**: v0.1  
> **日期**: 2026-03-30  
> **依据**:《游戏规则说明书》v0.3.5（§5.2 清理阶段、§6.4 鬼王系统）、`docs/design/boss-framework.md`、`策划文档/卡牌数据/鬼王卡.md` 及 `卡牌具体文档/boss_*.md`  
> **目的**: 锁定服务端 `GameState` 语义、清理阶段顺序、翻鬼王与来袭顺序；与实现收敛时以此为准。

### 0. 实现边界（与妖怪御魂解耦）

推进本 spec 时：

- **允许**：`MultiplayerGame` 鬼王/清理阶段分支、`BossEffects.ts`（鬼王**来袭**与打出鬼王**御魂**效果的服务端管线）、`GameState` / `FieldState` 字段、与本 spec 对齐的集成测试。
- **禁止（冻结）**：修改 **`shared/game/effects/YokaiEffects.ts`** 内**妖怪御魂**（游荡妖怪/手牌御魂）的**具体效果实现**与行为；客户端已对妖怪御魂做了一轮实机验证，避免双轨推进时行级改动御魂逻辑。若鬼王流程需用到妖怪能力，**仅调用现有公开 API**，不重构效果体。
- 说明：策划用语中鬼王卡也是「御魂牌」，本条冻结的是**妖怪**侧 `YokaiEffects`，**不是**禁止改 `BossEffects`。

---

## 1. 战场与状态字段

### 1.1 `FieldState`（已有）

- `currentBoss`：公共区域「鬼王区」当前鬼王卡定义（或 `null`）。
- `bossCurrentHp`：当前鬼王剩余生命（行动阶段扣减；清理阶段按规则恢复/清零未用伤害）。
- `bossDeck`：尚未登场的鬼王栈；开局阶段内顺序固定（标准/多人剔除 🔷 后组牌）。

### 1.2 建议升格为 `GameState` 正式字段（现多挂在 `(state as any)`）

| 字段 | 含义 |
|------|------|
| `pendingBossReveal` | 本回合清理阶段在「抽 5 张 + 补满 6 游荡妖」之后翻下一张鬼王并执行来袭 |
| `pendingGameEnd` | 本次击败的是最后一只鬼王；清理末尾结束对局 |
| `bossDefeatedByPlayerId` | 本回合击杀**上一只**鬼王的玩家；清理翻牌时**应等于**当回合进入清理阶段的**当前回合玩家**（见 §3） |

### 1.3 持续机制（与单卡文档对齐）

- **地震鲶**：每名玩家在自己回合的清理阶段、**补满 5 张手牌之后**，仅对**该玩家**随机藏 1 张至 `cardsUnderOnmyoji`（命名可与实现一致）；**非**同一次清理内全员同时藏。击败地震鲶后，全员阴阳师下藏牌**规则弃置**至弃牌堆。
- **八岐大蛇**：式神能力抑制至离场；与 `clearBossEffect` 配对恢复。

---

## 2. 行动阶段：击杀鬼王

**统一语义（所有入口须一致）：**

1. `markTurnHadKill()`（强者离场等）。
2. 鬼王进入击杀者 `discard`（退治）。
3. `clearBossEffect(旧鬼王名)`。
4. `currentBoss = null`，`bossCurrentHp = 0`。
5. 若 `bossDeck` 已空 → `pendingGameEnd = true`；否则 `pendingBossReveal = true` 且 `bossDefeatedByPlayerId = 击杀者 id`。
6. 发出 `BOSS_DEFEATED` 等。

**禁止**在击杀当刻调用 `revealBoss()` / 执行来袭；翻牌与来袭仅在清理阶段 §3 步骤 7。

---

## 3. 清理阶段顺序（与说明书对齐）

对**当前回合玩家**（刚结束行动、进入清理者）依次：

1. 伤害池重置；存档本回合是否击杀（游荡/鬼王）。
2. 场上游荡妖与**仍存在的鬼王**生命回满（若有）；当前玩家未用伤害清零。
3. 手牌与已打出区 → **规则弃置**；麒麟【触】、阴摩罗等回合末效果。
4. **从牌库抽 5 张**为下回合（当次）手牌。
5. **补满游荡妖怪展示区至 6 张**。
6. **若 `pendingBossReveal`**：置假 → `revealBoss()`，并对非麒麟鬼王执行 **§4 来袭**（须**执行完毕**后再进入下一步）。  
7. **若 `pendingGameEnd`**：结束游戏。
8. 写 `lastPlayerKilledYokai` 等，`nextTurn()`。

**刚性约束**：来袭作用在步骤 4 已形成的牌库/手牌上；故**翻牌不得早于步骤 4–5**。

**地震鲶藏牌**（当场鬼王为地震鲶时）：在步骤 **4 完成之后**、对**当前清理玩家**执行藏 1 张；若同一次清理含步骤 6 翻牌，藏牌与翻牌相对顺序实现上应固定（建议：**先步骤 4 后藏牌，再步骤 5 补妖，再步骤 6**，避免与补牌/翻牌插错；若产品与策划另有细则再改本条）。

---

## 4. 【鬼王来袭】顺序

1. 从 `bossDeck` 弹出下一只，写入 `currentBoss` / `bossCurrentHp`；可发 `BOSS_ARRIVAL`。
2. 麒麟：无来袭，结束。
3. 其余：从 **当前回合玩家**（= 击败上一只鬼王者，`bossDefeatedByPlayerId`）起 **顺时针**，**逐人依次**结算（非并行）。
4. 青女房等防御：`pendingChoice` + `timerMode: 'offTurnResponse'` 等与《pending-choice UI》《§5.4》一致。
5. 来袭管线必须 **await** 完成后再 `nextTurn()`，禁止 fire-and-forget 与清理阶段竞态。

---

## 5. 已知实现债务（收敛目标）

- `BossEffects` 内默认自动 `onChoice` / `onSelectCards` 应付正式多人待替换为真实 `pendingChoice` 回传。

---

## 6. 已落地（代码）

- `GameState`：`pendingBossReveal`、`pendingGameEnd`、`bossDefeatedByPlayerId`（服务端与 `shared/types/game` 同步）。
- `PlayerState`：`cardsUnderOnmyoji`（地震鲶等）；`clearBossEffect` / `clearEarthquakeCatfishEffect` 与此字段及旧 `hiddenCards` 兼容。
- 击杀鬼王：`defeatBoss` 统一语义；`handleAttackBoss` 击杀时走 `defeatBoss`；`handleRetireBoss` 翻下场改为清理阶段 `pendingBossReveal`。
- 清理阶段：`enterCleanupPhase` 为 `async`，`await revealBoss()`；翻牌后执行来袭与 `nextTurn` 顺序一致。
- 地震鲶：当场鬼王为地震鲶时，于**抽 5 张后**、**翻牌后**对当前清理玩家各尝试藏 1 张（手牌非空时）。
- 来袭顺序：`BossEffects` 通过上下文 `arrivalStartPlayerId`（即 `bossDefeatedByPlayerId`）从击败者起顺时针迭代玩家。

---

## 7. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-03-30 | 初稿：状态机、来袭首名=当前清理玩家、地震鲶按人清理藏牌 |
| 2026-03-30 | 说明书 §6.4 / 十二节链接；本节 §6 记录代码落地项 |
| 2026-03-30 | §0：妖怪御魂（YokaiEffects）实现冻结边界，与客户端御魂实机验证对齐 |

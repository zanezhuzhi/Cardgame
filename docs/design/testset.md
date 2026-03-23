# 测试条件集

> 用于开发测试的临时条件，正式发布前需关闭

---

## 当前启用的测试条件

### 单人模式 (SinglePlayerGame.ts)

| ID | 描述 | 状态 | 代码位置 |
|----|------|------|----------|
| test1 | 初始手牌增加1/2/3阶阴阳术 | ❌ 关闭 | SinglePlayerGame.ts |
| test2 | 初始手牌增加1/2/3/3阶阴阳术 | ❌ 关闭 | SinglePlayerGame.ts |
| test3 | 测试中级/高级符咒获取条件 | ❌ 关闭 | SinglePlayerGame.ts |

### 多人模式 (MultiplayerGame.ts)

| ID | 描述 | 状态 | 代码位置 |
|----|------|------|----------|
| test2-1 | 初始手牌增加1/2/3阶阴阳术 | ✅ 启用 | server/src/game/MultiplayerGame.ts |
| test2-2 | 初始手牌增加1/2/3/3阶阴阳术 | ❌ 关闭 | server/src/game/MultiplayerGame.ts |
| test2-3 | 测试中级/高级符咒获取条件 | ❌ 关闭 | server/src/game/MultiplayerGame.ts |

---

## 测试条件详情

### test1 - 初始阴阳术（获得式神）
**目的**：测试获得式神功能

**效果**：初始手牌增加基础术式(1)+中级符咒(2)+高级符咒(3)=6点

**关闭方式**：将 `TEST1_ENABLED` 改为 `false`

---

### test2 - 初始阴阳术（置换式神）
**目的**：测试置换式神功能

**效果**：初始手牌增加基础术式(1)+中级符咒(2)+高级符咒(3)×2=9点

**使用流程**：
1. 用1+2+3=6点获得第3个式神
2. 用剩余的高级符咒(3点)置换式神

**关闭方式**：将 `TEST2_ENABLED` 改为 `false`

---

### test3 - 测试中级/高级符咒获取
**目的**：测试获得中级符咒和高级符咒的条件判断

**效果**：
- 手牌中增加：1张基础术式 + 1张中级符咒
- 弃牌堆中增加：1张生命≥2的妖怪 + 1张生命≥4的妖怪

**测试内容**：
1. 中级符咒获取：超度基础术式 + 弃牌堆有生命≥2妖怪 → 获得中级符咒
2. 高级符咒获取：超度中级符咒 + 弃牌堆有生命≥4妖怪 → 获得高级符咒

**关闭方式**：将 `TEST3_ENABLED` 改为 `false`

---

## 式神获取/置换规则

### 获得式神（式神<3时）
**条件**：
- 持有式神 < 3 个
- 手牌中有高级符咒（3点伤害）
- 符咒总伤害 ≥ 5 点

**流程**：
1. 选择符咒超度（≥5点，必须含高级符咒）
2. 从式神商店随机抽2张，选择1张获得

### 置换式神（式神=3时）
**条件**：
- 持有式神 = 3 个
- 手牌中有高级符咒（3点伤害）

**流程**：
1. 选择1张高级符咒超度
2. 从式神商店随机抽2张，选择1张作为新式神
3. 选择1个现有式神替换掉（返回商店底部）
4. 新式神加入

---

## 已关闭的测试条件

（暂无）

---

## 🎮 GM 指令 API

> **使用流程**：
> 1. 用户截图告诉开发者当前 `房间ID` 和 `玩家ID`（显示在游戏界面左上角）
> 2. 开发者使用以下 HTTP API 创建测试环境

### 基础信息

- **服务器地址**: `http://localhost:3001`
- **请求方式**: 全部为 `GET` 请求，可直接在浏览器地址栏执行

### 指令列表

| 指令 | 功能 | API 格式 |
|------|------|----------|
| GM1 | 添加测试卡牌(1+2+3+3) | `/api/gm/addcards/:roomId/:playerId` |
| GM2 | 添加指定卡牌到手牌 | `/api/gm/addcard/:roomId/:playerId/:cardName/:count` |
| GM3 | 替换玩家式神 | `/api/gm/setshikigami/:roomId/:playerId/:slotIndex/:shikigamiName` |
| GM4 | 替换场上妖怪 | `/api/gm/setyokai/:roomId/:slotIndex/:yokaiName` |
| GM5 | 添加卡牌到弃牌堆 | `/api/gm/discard/:roomId/:playerId/:cardName/:count` |
| GM6 | 给玩家添加伤害值 | `/api/gm/adddamage/:roomId/:playerId/:damage` |
| GM7 | 替换当前鬼王 | `/api/gm/setboss/:roomId/:bossName` |

### 使用示例

假设房间ID为 `ABC123`，玩家ID为 `player_xxx`：

```bash
# GM1: 添加测试卡牌(1+2+3+3=9点伤害)
http://localhost:3001/api/gm/addcards/ABC123/player_xxx

# GM2: 添加3张高级符咒到手牌
http://localhost:3001/api/gm/addcard/ABC123/player_xxx/高级符咒/3

# GM3: 将0号槽位式神替换为茨木童子
http://localhost:3001/api/gm/setshikigami/ABC123/player_xxx/0/茨木童子

# GM4: 将0号槽位妖怪替换为灯笼鬼
http://localhost:3001/api/gm/setyokai/ABC123/0/灯笼鬼

# GM5: 添加1张灯笼鬼到弃牌堆
http://localhost:3001/api/gm/discard/ABC123/player_xxx/灯笼鬼/1

# GM6: 给玩家添加100点伤害
http://localhost:3001/api/gm/adddamage/ABC123/player_xxx/100

# GM7: 将当前鬼王替换为八岐大蛇
http://localhost:3001/api/gm/setboss/ABC123/八岐大蛇
```

### 常用测试场景

#### 场景1：测试获得式神
```bash
# 给玩家添加足够的阴阳术
http://localhost:3001/api/gm/addcards/{roomId}/{playerId}
# 或直接添加高级符咒
http://localhost:3001/api/gm/addcard/{roomId}/{playerId}/高级符咒/2
```

#### 场景2：测试中级符咒兑换
```bash
# 1. 添加基础术式到手牌
http://localhost:3001/api/gm/addcard/{roomId}/{playerId}/基础术式/1
# 2. 添加生命≥2的妖怪到弃牌堆
http://localhost:3001/api/gm/discard/{roomId}/{playerId}/灯笼鬼/1
```

#### 场景3：测试鬼王击杀
```bash
# 给玩家添加大量伤害
http://localhost:3001/api/gm/adddamage/{roomId}/{playerId}/100
```

---

## 返回格式

所有 GM API 返回 JSON 格式：

```json
// 成功
{ "success": true }

// 失败
{ "success": false, "error": "错误原因" }
```
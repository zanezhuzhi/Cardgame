# 测试条件集（精简版）

> 目标：快速知道“现在开了什么测试、怎么测、GM怎么用”

---

## 1) 当前测试开关

### 单人（`client/src/game/SinglePlayerGame.ts`）

| ID | 描述 | 状态 |
|----|------|------|
| test1 | 初始手牌增加1/2/3阶阴阳术 | 关闭 |
| test2 | 初始手牌增加1/2/3/3阶阴阳术 | 关闭 |
| test3 | 中级/高级符咒获取条件测试 | 关闭 |
| test4 | 初始御魂（赤舌/唐纸伞妖/天邪鬼绿） | 启用 |

### 多人（`server/src/game/MultiplayerGame.ts`）

| ID | 描述 | 状态 |
|----|------|------|
| test2-1 | 初始手牌增加1/2/3阶阴阳术 | 启用 |
| test2-2 | 初始手牌增加1/2/3/3阶阴阳术 | 关闭 |
| test2-3 | 中级/高级符咒获取条件测试 | 关闭 |

开关方式：搜索 `TEST*_ENABLED`，改 `true/false`。

---

## 2) 自动化测试入口

```bash
cd shared && npm test
cd server && npm test
```

专项清单：
- `docs/TEST_CHECKLIST_SPELL.md`
- `docs/TEST_CHECKLIST_SHIKIGAMI.md`
- `docs/MULTIPLAYER_SCENARIOS.md`

---

## 3) GM 测试（HTTP API）

服务地址：`http://localhost:3001`（GET）

| 指令 | 功能 | 路径 |
|------|------|------|
| GM1 | 添加测试卡组(1+2+3+3) | `/api/gm/addcards/:roomId/:playerId` |
| GM2 | 加卡到手牌 | `/api/gm/addcard/:roomId/:playerId/:cardName/:count` |
| GM3 | 替换式神 | `/api/gm/setshikigami/:roomId/:playerId/:slotIndex/:shikigamiName` |
| GM4 | 替换场上妖怪 | `/api/gm/setyokai/:roomId/:slotIndex/:yokaiName` |
| GM5 | 加卡到弃牌堆 | `/api/gm/discard/:roomId/:playerId/:cardName/:count` |
| GM6 | 增加伤害值 | `/api/gm/adddamage/:roomId/:playerId/:damage` |
| GM7 | 替换鬼王 | `/api/gm/setboss/:roomId/:bossName` |

返回：

```json
{ "success": true }
{ "success": false, "error": "错误原因" }
```

---

## 4) GM 测试（游戏内输入）

> 在游戏聊天输入框中输入 `/` 开头指令

- 输入位置：右侧信息区底部聊天栏
- 触发：`/xxx` 后回车或点击发送
- 显示：`⚙️ [GM] ...`（仅发送者可见）
- 冷却：不受聊天 5 秒冷却限制

当前可用：

| 指令 | 作用 |
|------|------|
| `/help` | 查看可用指令 |
| `/status` | 查看房间状态和玩家数 |
| `/ping` | 连通性检查 |

实现位置：
- 服务端：`server/src/socket/SocketServer.ts` -> `executeGMCommand()`
- 单人本地：`client/src/App.vue` -> `handleLocalGMCommand()`

---

## 5) 当前手测建议（最小集）

1. 发送普通聊天，确认全房间可见。
2. 连续发送两条聊天，确认第2条受5秒冷却。
3. 输入 `/help`，确认显示 GM 结果且仅自己可见。
4. 使用 test4/test2-1 验证御魂与阴阳术测试流程。


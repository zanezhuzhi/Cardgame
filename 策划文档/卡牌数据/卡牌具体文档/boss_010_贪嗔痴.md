# boss_010 贪嗔痴

> **文档版本**: v1.0  
> **创建日期**: 2025-01-XX  
> **最后更新**: 2025-01-XX  
> **开发状态**: 📋 待开发

---

## 1. 基础信息

| 属性 | 值 | 说明 |
|------|-----|------|
| **卡牌ID** | boss_010 | cards.json 中的唯一标识 |
| **名称** | 贪嗔痴 | 佛教三毒，又称三惑 |
| **阶段** | Ⅲ | 第三阶段Boss |
| **生命值** | 15 | 最高生命值鬼王 |
| **声誉** | +5 | 击败获得声誉 |
| **关键词** | 御魂 | 可作为御魂使用 |
| **🔷多人专属** | 是 | 5人以上游戏专属 |

---

## 2. 效果定义（策划原文）

### 2.1 来袭效果
> **每位玩家随机弃掉1张手牌，弃掉生命值最高的1位或多位玩家再弃置1张手牌。**

### 2.2 御魂效果
> **抓牌+1，超度1张手牌，选择1个妖怪或鬼王，对其造成等同超度牌生命的伤害。【自】：你的回合开始时，如果此牌在弃牌堆中，则将其置入手牌。**

---

## 3. 效果分解

### 3.1 来袭效果分解

#### 步骤1: 全体随机弃牌
- **触发条件**: 贪嗔痴翻出时（清理阶段步骤5）
- **影响范围**: 所有玩家
- **执行逻辑**:
  1. 遍历所有玩家
  2. 若手牌数>0，随机选择1张弃置
  3. 记录每位玩家弃牌后手牌中的最高HP

#### 步骤2: 找出最高HP玩家
- **比较对象**: 所有玩家弃牌后手牌的最高HP
- **处理规则**:
  - 计算每位玩家手牌中HP最高的牌
  - 找出"手牌最高HP"值最大的玩家
  - **允许并列**: 可能有多位玩家同为最高

#### 步骤3: 最高HP玩家额外弃牌
- **触发条件**: 步骤2中确定的最高HP玩家
- **执行逻辑**:
  1. 所有"最高HP玩家"各自再随机弃1张
  2. 若该玩家手牌已空，则跳过

### 3.2 御魂效果分解

#### 步骤1: 抓牌+1
- **执行**: 玩家从牌库抓1张牌

#### 步骤2: 超度选择
- **交互类型**: `salvageChoice`
- **选择范围**: 手牌中任意1张
- **选择数量**: 必须选择1张（强制超度）
- **执行**: 将选中的牌移至超度区

#### 步骤3: 目标选择
- **交互类型**: `targetSelection`
- **选择范围**: 场上的妖怪槽位 + 当前鬼王
- **执行**: 玩家选择1个目标

#### 步骤4: 造成伤害
- **伤害值**: 等于超度牌的HP值
- **特殊处理**:
  - 若超度的牌无HP属性，视为0伤害
  - 伤害直接扣减目标的当前HP

#### 步骤5: 【自】回合开始回收
- **触发时机**: 玩家回合开始时（鬼火阶段前）
- **触发条件**: 此牌在弃牌堆中
- **执行**: 将此牌移至手牌

---

## 4. AI 决策逻辑

### 4.1 来袭效果（服务端自动执行）
```typescript
function executeArrival_贪嗔痴(gameState: GameState): void {
  // 步骤1: 全体随机弃牌
  const playerMaxHps: Array<{playerId: string, maxHp: number}> = [];
  
  for (const player of getAllPlayers(gameState)) {
    if (player.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const discarded = player.hand.splice(randomIndex, 1)[0];
      player.discard.push(discarded);
      addLog(`💀 贪嗔痴来袭：${player.name} 随机弃置 ${discarded.name}`);
    }
    
    // 记录弃牌后手牌最高HP
    const maxHp = player.hand.reduce((max, card) => 
      Math.max(max, card.hp || 0), 0);
    playerMaxHps.push({ playerId: player.id, maxHp });
  }
  
  // 步骤2: 找出最高HP玩家（可能多位并列）
  const highestMaxHp = Math.max(...playerMaxHps.map(p => p.maxHp));
  const highestPlayers = playerMaxHps
    .filter(p => p.maxHp === highestMaxHp && p.maxHp > 0);
  
  // 步骤3: 最高HP玩家额外弃牌
  for (const { playerId } of highestPlayers) {
    const player = getPlayer(gameState, playerId);
    if (player.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const discarded = player.hand.splice(randomIndex, 1)[0];
      player.discard.push(discarded);
      addLog(`💀 贪嗔痴惩罚：${player.name}（手牌最高HP）再弃置 ${discarded.name}`);
    }
  }
}
```

### 4.2 御魂效果AI逻辑
```typescript
function aiDecide_贪嗔痴(player: PlayerState, targets: CardInstance[]): {
  exileCard: CardInstance;
  targetId: string;
} {
  // 选择超度牌策略：优先选HP最高的牌以造成最大伤害
  const handByHp = [...player.hand].sort((a, b) => 
    (b.hp || 0) - (a.hp || 0));
  
  // 但也要考虑牌的价值，不超度鬼王御魂
  const exileCandidate = handByHp.find(card => 
    card.cardType !== 'boss' && (card.hp || 0) > 0
  ) || handByHp[0];
  
  // 选择目标策略：能击杀的目标 > HP最低的目标
  const exileHp = exileCandidate.hp || 0;
  
  // 优先击杀
  const killable = targets.find(t => t.hp <= exileHp);
  if (killable) {
    return { exileCard: exileCandidate, targetId: killable.instanceId };
  }
  
  // 否则打HP最低的
  const lowestHpTarget = targets.reduce((lowest, t) => 
    t.hp < lowest.hp ? t : lowest, targets[0]);
  
  return { exileCard: exileCandidate, targetId: lowestHpTarget.instanceId };
}
```

---

## 5. TDD 测试用例

### 5.1 来袭效果测试

```typescript
describe('贪嗔痴 - 来袭效果', () => {
  describe('🟢 正常流程', () => {
    it('所有玩家各随机弃1张', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [createCard('A', 5), createCard('B', 3)] }),
        createPlayer('p2', { hand: [createCard('C', 4)] }),
      ]);
      
      executeBossArrival('贪嗔痴', gameState);
      
      // 每位玩家都弃了1张（至少）
      expect(gameState.players[0].discard.length).toBeGreaterThanOrEqual(1);
      expect(gameState.players[1].discard.length).toBeGreaterThanOrEqual(1);
    });
    
    it('手牌最高HP玩家额外弃1张', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [
          createCard('A', 10), // 最高HP
          createCard('B', 3),
          createCard('C', 2),
        ]}),
        createPlayer('p2', { hand: [
          createCard('D', 5),
          createCard('E', 4),
        ]}),
      ]);
      
      // Mock随机，确保第一轮各弃最低HP的牌
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.99) // p1弃C(index 2)
        .mockReturnValueOnce(0.99) // p2弃E(index 1)
        .mockReturnValueOnce(0.5); // p1额外弃
      
      executeBossArrival('贪嗔痴', gameState);
      
      // p1手牌最高HP=10 > p2手牌最高HP=5
      // p1共弃2张，p2弃1张
      expect(gameState.players[0].discard.length).toBe(2);
      expect(gameState.players[1].discard.length).toBe(1);
    });
    
    it('多位玩家并列最高HP都额外弃牌', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [createCard('A', 8), createCard('B', 3)] }),
        createPlayer('p2', { hand: [createCard('C', 8), createCard('D', 2)] }),
        createPlayer('p3', { hand: [createCard('E', 5)] }),
      ]);
      
      executeBossArrival('贪嗔痴', gameState);
      
      // p1和p2并列最高HP=8，都要额外弃牌
      // p3只弃1张
      expect(gameState.players[0].discard.length).toBe(2);
      expect(gameState.players[1].discard.length).toBe(2);
      expect(gameState.players[2].discard.length).toBe(1);
    });
  });
  
  describe('🔴 边界条件', () => {
    it('玩家手牌为空时跳过', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [] }),
        createPlayer('p2', { hand: [createCard('A', 5)] }),
      ]);
      
      executeBossArrival('贪嗔痴', gameState);
      
      expect(gameState.players[0].discard.length).toBe(0);
      expect(gameState.players[1].discard.length).toBe(1);
    });
    
    it('第一轮弃牌后手牌为空，不参与HP比较', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [createCard('A', 10)] }), // 只有1张
        createPlayer('p2', { hand: [createCard('B', 5), createCard('C', 3)] }),
      ]);
      
      executeBossArrival('贪嗔痴', gameState);
      
      // p1第一轮弃牌后手牌空，不参与HP比较
      // p2成为唯一的"最高HP玩家"（HP=5）
      expect(gameState.players[0].discard.length).toBe(1); // 只弃1张
      expect(gameState.players[1].discard.length).toBe(2); // 额外弃1张
    });
    
    it('所有玩家第一轮后手牌都空', () => {
      const gameState = createGameState([
        createPlayer('p1', { hand: [createCard('A', 10)] }),
        createPlayer('p2', { hand: [createCard('B', 5)] }),
      ]);
      
      executeBossArrival('贪嗔痴', gameState);
      
      // 第一轮后都空，没人额外弃牌
      expect(gameState.players[0].discard.length).toBe(1);
      expect(gameState.players[1].discard.length).toBe(1);
    });
  });
});
```

### 5.2 御魂效果测试

```typescript
describe('贪嗔痴 - 御魂效果', () => {
  describe('🟢 正常流程', () => {
    it('抓牌+1，超度后对目标造成等HP伤害', async () => {
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [createCard('Sacrifice', 7)],
      });
      const yokai = createYokaiSlot('测试妖怪', 10);
      const ctx = createTestContext(player, { yokaiSlots: [yokai] });
      
      ctx.triggerInteract = async (options) => {
        if (options.type === 'salvageChoice') return player.hand[0].instanceId;
        if (options.type === 'targetSelection') return yokai.instanceId;
        return null;
      };
      
      await executeBossSoulEffect('贪嗔痴', ctx);
      
      expect(player.hand.length).toBe(1); // 抓1张，超度1张
      expect(player.exiled.length).toBe(1);
      expect(player.exiled[0].name).toBe('Sacrifice');
      expect(yokai.hp).toBe(3); // 10 - 7 = 3
    });
    
    it('可以选择鬼王作为目标', async () => {
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [createCard('Sacrifice', 8)],
      });
      const boss = createBossCard('测试鬼王', 15);
      const ctx = createTestContext(player, { currentBoss: boss });
      
      ctx.triggerInteract = async (options) => {
        if (options.type === 'salvageChoice') return player.hand[0].instanceId;
        if (options.type === 'targetSelection') return boss.instanceId;
        return null;
      };
      
      await executeBossSoulEffect('贪嗔痴', ctx);
      
      expect(boss.hp).toBe(7); // 15 - 8 = 7
    });
    
    it('伤害足够时击杀目标', async () => {
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [createCard('HighHpCard', 12)],
      });
      const yokai = createYokaiSlot('弱妖怪', 5);
      const ctx = createTestContext(player, { yokaiSlots: [yokai] });
      
      ctx.triggerInteract = async (options) => {
        if (options.type === 'salvageChoice') return player.hand[0].instanceId;
        if (options.type === 'targetSelection') return yokai.instanceId;
        return null;
      };
      
      await executeBossSoulEffect('贪嗔痴', ctx);
      
      expect(yokai.hp).toBeLessThanOrEqual(0);
      // 应触发妖怪退治逻辑
    });
  });
  
  describe('🟡 【自】回收效果', () => {
    it('回合开始时从弃牌堆回收到手牌', () => {
      const bossCard = createBossCard('贪嗔痴', 15);
      const player = createTestPlayer({
        discard: [bossCard],
        hand: [],
      });
      
      triggerTurnStart(player);
      
      expect(player.discard.length).toBe(0);
      expect(player.hand.length).toBe(1);
      expect(player.hand[0].name).toBe('贪嗔痴');
    });
    
    it('不在弃牌堆则不触发', () => {
      const bossCard = createBossCard('贪嗔痴', 15);
      const player = createTestPlayer({
        hand: [bossCard], // 在手牌而非弃牌堆
        discard: [],
      });
      
      triggerTurnStart(player);
      
      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(0);
    });
  });
  
  describe('🔴 边界条件', () => {
    it('超度无HP属性的牌，造成0伤害', async () => {
      const spellCard = createCard('spell', 'spell_001'); // 阴阳术无HP
      spellCard.hp = undefined;
      
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [spellCard],
      });
      const yokai = createYokaiSlot('测试妖怪', 10);
      const ctx = createTestContext(player, { yokaiSlots: [yokai] });
      
      ctx.triggerInteract = async (options) => {
        if (options.type === 'salvageChoice') return spellCard.instanceId;
        if (options.type === 'targetSelection') return yokai.instanceId;
        return null;
      };
      
      await executeBossSoulEffect('贪嗔痴', ctx);
      
      expect(yokai.hp).toBe(10); // 0伤害，HP不变
    });
    
    it('手牌为空无法超度', async () => {
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [],
      });
      const ctx = createTestContext(player, {});
      
      const result = await executeBossSoulEffect('贪嗔痴', ctx);
      
      // 抓牌后手牌为1张，必须超度这张
      expect(player.exiled.length).toBe(1);
    });
    
    it('场上无可攻击目标时取消效果', async () => {
      const player = createTestPlayer({
        deck: [createCard('DrawCard', 5)],
        hand: [createCard('Sacrifice', 7)],
      });
      const ctx = createTestContext(player, {
        yokaiSlots: [], // 无妖怪
        currentBoss: null, // 无鬼王
      });
      
      ctx.triggerInteract = async (options) => {
        if (options.type === 'salvageChoice') return player.hand[0].instanceId;
        return null; // 无目标可选
      };
      
      const result = await executeBossSoulEffect('贪嗔痴', ctx);
      
      // 超度执行但无伤害目标
      expect(player.exiled.length).toBe(1);
      expect(result.message).toContain('无可攻击目标');
    });
  });
});
```

---

## 6. 实现代码（伪代码）

### 6.1 来袭效果实现

```typescript
// shared/game/effects/BossEffects.ts

registerBossArrival('贪嗔痴', async (ctx) => {
  const { gameState, addLog } = ctx;
  
  // ===== 步骤1: 全体随机弃牌 =====
  interface PlayerHpInfo {
    playerId: string;
    playerName: string;
    maxHp: number;
    hasCards: boolean;
  }
  
  const playerHpInfos: PlayerHpInfo[] = [];
  
  for (const player of getAllPlayers(gameState)) {
    if (player.hand.length > 0) {
      // 随机弃1张
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const discarded = player.hand.splice(randomIndex, 1)[0];
      player.discard.push(discarded);
      addLog(`💀 贪嗔痴来袭：${player.name} 随机弃置 ${discarded.name}`);
    }
    
    // 计算弃牌后手牌最高HP
    const maxHp = player.hand.length > 0
      ? Math.max(...player.hand.map(c => c.hp || 0))
      : 0;
    
    playerHpInfos.push({
      playerId: player.id,
      playerName: player.name,
      maxHp,
      hasCards: player.hand.length > 0,
    });
  }
  
  // ===== 步骤2: 找出最高HP玩家 =====
  const validPlayers = playerHpInfos.filter(p => p.hasCards && p.maxHp > 0);
  
  if (validPlayers.length === 0) {
    addLog(`💀 贪嗔痴来袭：所有玩家手牌已空或无HP牌，惩罚跳过`);
    return { success: true };
  }
  
  const highestMaxHp = Math.max(...validPlayers.map(p => p.maxHp));
  const highestPlayers = validPlayers.filter(p => p.maxHp === highestMaxHp);
  
  // ===== 步骤3: 最高HP玩家额外弃牌 =====
  for (const info of highestPlayers) {
    const player = getPlayer(gameState, info.playerId);
    if (player.hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      const discarded = player.hand.splice(randomIndex, 1)[0];
      player.discard.push(discarded);
      addLog(`💀 贪嗔痴惩罚：${player.name}（手牌最高HP=${info.maxHp}）再弃置 ${discarded.name}`);
    }
  }
  
  return { success: true };
});
```

### 6.2 御魂效果实现

```typescript
// shared/game/effects/BossEffects.ts

registerBossSoul('贪嗔痴', async (ctx) => {
  const { player, gameState, triggerInteract, addLog } = ctx;
  
  // ===== 步骤1: 抓牌+1 =====
  drawCards(player, 1);
  addLog(`🎴 ${player.name} 抓牌+1`);
  
  // ===== 步骤2: 超度选择（强制） =====
  if (player.hand.length === 0) {
    addLog(`⚠️ ${player.name} 手牌为空，无法超度`);
    return { success: false, error: '手牌为空，无法超度' };
  }
  
  const salvageChoice = await triggerInteract?.({
    type: 'salvageChoice',
    playerId: player.id,
    cards: player.hand,
    prompt: '选择1张手牌超度',
    required: true,
    count: 1,
  });
  
  const exileCardId = salvageChoice as string;
  const exileIndex = player.hand.findIndex(c => c.instanceId === exileCardId);
  
  if (exileIndex === -1) {
    // 默认超度第一张
    const defaultCard = player.hand.shift()!;
    player.exiled.push(defaultCard);
    addLog(`🔮 ${player.name} 超度 ${defaultCard.name}（默认选择）`);
  } else {
    const exiledCard = player.hand.splice(exileIndex, 1)[0];
    player.exiled.push(exiledCard);
    addLog(`🔮 ${player.name} 超度 ${exiledCard.name}`);
  }
  
  const exiledCard = player.exiled[player.exiled.length - 1];
  const damageValue = exiledCard.hp || 0;
  
  // ===== 步骤3: 目标选择 =====
  const availableTargets: CardInstance[] = [];
  
  // 添加妖怪槽位
  for (const slot of gameState.field.yokaiSlots) {
    if (slot && slot.hp > 0) {
      availableTargets.push(slot);
    }
  }
  
  // 添加当前鬼王
  if (gameState.field.currentBoss && gameState.field.currentBoss.hp > 0) {
    availableTargets.push(gameState.field.currentBoss);
  }
  
  if (availableTargets.length === 0) {
    addLog(`⚠️ 场上无可攻击目标，伤害效果取消`);
    return { success: true, message: '超度成功，但无可攻击目标' };
  }
  
  const targetChoice = await triggerInteract?.({
    type: 'targetSelection',
    playerId: player.id,
    targets: availableTargets,
    prompt: `选择目标造成${damageValue}点伤害`,
  });
  
  const targetId = targetChoice as string;
  const target = availableTargets.find(t => t.instanceId === targetId)
    || availableTargets[0]; // 默认第一个
  
  // ===== 步骤4: 造成伤害 =====
  target.hp -= damageValue;
  addLog(`⚔️ ${player.name} 对 ${target.name} 造成 ${damageValue} 点伤害`);
  
  if (target.hp <= 0) {
    addLog(`💀 ${target.name} 被击败！`);
    // 触发击杀逻辑（区分妖怪/鬼王）
    if (target.cardType === 'boss') {
      // 鬼王击败处理
      handleBossDefeat(player, target, gameState);
    } else {
      // 妖怪退治处理
      handleYokaiDefeat(player, target, gameState);
    }
  }
  
  return { 
    success: true, 
    damage: player.damage, // 不直接加伤害，通过超度牌HP造成
    message: `超度 ${exiledCard.name}，对 ${target.name} 造成 ${damageValue} 伤害`
  };
});
```

### 6.3 【自】回收效果实现

```typescript
// shared/game/effects/BossEffects.ts

registerTurnStartTrigger('贪嗔痴', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 检查弃牌堆中是否有贪嗔痴
  const cardIndex = player.discard.findIndex(
    c => c.cardId === 'boss_010' || c.name === '贪嗔痴'
  );
  
  if (cardIndex !== -1) {
    const card = player.discard.splice(cardIndex, 1)[0];
    player.hand.push(card);
    addLog(`🔄 【自】${player.name} 的贪嗔痴从弃牌堆回到手牌`);
    return { triggered: true };
  }
  
  return { triggered: false };
});
```

---

## 7. 交互设计

### 7.1 来袭效果（自动执行）
- **无需玩家交互**: 随机弃牌由服务端自动完成
- **日志显示**: 
  - 第一轮: "💀 贪嗔痴来袭：[玩家名] 随机弃置 [卡牌名]"
  - 惩罚轮: "💀 贪嗔痴惩罚：[玩家名]（手牌最高HP=X）再弃置 [卡牌名]"

### 7.2 御魂效果交互

#### 超度选择
```typescript
{
  type: 'salvageChoice',
  playerId: string,
  cards: CardInstance[],
  prompt: '选择1张手牌超度',
  required: true,
  count: 1,
}
```

#### 目标选择
```typescript
{
  type: 'targetSelection',
  playerId: string,
  targets: CardInstance[], // 妖怪+鬼王
  prompt: `选择目标造成${damageValue}点伤害`,
}
```

### 7.3 UI显示建议
- 超度选择时高亮手牌，显示每张牌的HP
- 目标选择时显示可攻击单位及其当前HP
- 伤害预览：显示"将造成X点伤害"

---

## 8. 与其他效果的交互

### 8.1 与蜃气楼/荒骷髅的【自】回收
- **触发顺序**: 同一回合开始时，按卡牌在弃牌堆中的顺序触发
- **不冲突**: 各自独立回收，不影响彼此

### 8.2 与地震鲶隐藏牌
- **手牌计算**: 隐藏牌不计入HP比较
- **随机弃牌**: 只从可见手牌中随机

### 8.3 与八岐大蛇式神失能
- **无关联**: 贪嗔痴效果不涉及式神

---

## 9. 特殊规则说明

### 9.1 多人专属标记
- **适用条件**: 5人以上游戏
- **4人及以下**: 此鬼王不加入鬼王牌堆

### 9.2 "手牌最高HP"的判定
- **比较对象**: 玩家手牌中HP属性最高的单张牌
- **无HP牌**: 视为HP=0参与比较
- **并列处理**: 所有并列最高的玩家都额外弃牌

### 9.3 强制超度
- **必须执行**: 不能跳过超度步骤
- **手牌为空**: 抓牌后手牌不空则必须超度

---

## 10. 变更历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2025-01-XX | 初始创建，基于鬼王卡.md |

<template>
  <div class="game-container">
    <!-- 多人模式：等待加载状态 -->
    <div v-if="isMultiMode && !state" class="lobby">
      <div class="lobby-card">
        <h1>🎴 御魂传说</h1>
        <h2>多人对战模式</h2>
        <p class="tips">正在加载游戏状态...</p>
        <button @click="router.push('/')" class="btn">返回大厅</button>
      </div>
    </div>
    
    <!-- 单人模式：大厅 -->
    <div v-else-if="!isMultiMode && !inGame" class="lobby">
      <div class="lobby-card">
        <h1>🎴 御魂传说</h1>
        <h2>单人测试模式</h2>
        <input v-model="playerName" placeholder="输入名字" class="name-input" />
        <button @click="startGame" class="btn primary">开始游戏</button>
        <p class="tips">初始牌库：6基础术式 + 3招福达摩</p>
      </div>
    </div>

    <!-- 式神选取阶段 -->
    <div v-else-if="state?.phase === 'shikigamiSelect'" class="shikigami-select-phase">
      <div class="select-modal">
        <h2>🎭 选择式神</h2>
        <p class="select-hint">从下列4个式神中选择2个作为你的搭档</p>
        
        <!-- 多人模式倒计时 -->
        <div v-if="isMultiMode && shikigamiSelectCountdown > 0" class="countdown-bar">
          <span class="countdown-icon">⏱️</span>
          <span class="countdown-text">{{ shikigamiSelectCountdown }}s</span>
          <div class="countdown-progress" :style="{ width: (shikigamiSelectCountdown / 20 * 100) + '%' }"></div>
        </div>
        
        <div class="shikigami-options">
          <div v-for="s in shikigamiOptions" :key="s.id"
               class="shikigami-option"
               :class="{ selected: isShikigamiSelected(s.id) }"
               @click="toggleShikigamiSelection(s.id)"
               @mouseenter="showSelectShikigamiTooltip($event, s)"
               @mouseleave="hideTooltip">
            <div class="shikigami-card-inner">
              <img v-if="getCardImage(s)" :src="getCardImage(s)" class="shikigami-art" />
              <div class="shikigami-overlay">
                <div class="shikigami-name">{{ s.name }}</div>
                <div class="shikigami-rarity" :class="'rarity-' + s.rarity?.toLowerCase()">{{ s.rarity }}</div>
              </div>
            </div>
            <div class="select-badge" v-if="isShikigamiSelected(s.id)">✓</div>
          </div>
        </div>
        
        <div class="selected-preview">
          <span class="preview-label">已选择：</span>
          <template v-if="selectedShikigami.length > 0">
            <span v-for="s in selectedShikigami" :key="s.id" class="selected-tag">
              {{ s.name }}
              <button class="remove-btn" @click.stop="deselectShikigami(s.id)">×</button>
            </span>
          </template>
          <span v-else class="empty-hint">点击上方卡牌选择</span>
        </div>
        
        <button class="confirm-btn" 
                :class="{ ready: selectedShikigami.length >= 2, waiting: isWaitingOthers }"
                :disabled="selectedShikigami.length < 2 || isWaitingOthers"
                @click="confirmShikigamiSelection">
          {{ shikigamiConfirmButtonText }}
        </button>
      </div>
    </div>

    <!-- 游戏界面 -->
    <div v-else class="game-board">
      <!-- 顶部栏 (height:150px) -->
      <div class="top-row">
        <!-- 回合数 -->
        <div class="turn-display">第{{state?.turnNumber||1}}轮</div>
        
        <!-- 玩家轮序（从左到右依次行动） -->
        <div class="player-panel">
          <div class="player-info-slot" 
               v-for="(p, idx) in allPlayers" 
               :key="p.id"
               :class="{ 'is-current': idx === state?.currentPlayerIndex }">
            <div class="player-avatar" :class="{ active: idx === state?.currentPlayerIndex }">
              <span>{{ p.name?.charAt(0) || 'P' }}</span>
              <!-- 自己标签（头像右上角） -->
              <div v-if="p.id === myPlayerId" class="me-badge">自己</div>
            </div>
            <div class="player-stats">
              <div class="mini-stat"><span class="icon-hand-cards"></span>{{ p.hand?.length || 0 }}</div>
              <div class="mini-stat"><span>👑</span>{{ p.totalCharm || 0 }}</div>
            </div>
          </div>
          <!-- 空槽位（凑够6个） -->
          <div class="player-info-slot empty-slot" v-for="i in (6 - allPlayers.length)" :key="'empty-' + i">
            <div class="player-avatar empty"></div>
            <div class="player-stats">
              <div class="mini-stat empty-stat"></div>
              <div class="mini-stat empty-stat"></div>
            </div>
          </div>
        </div>
        
        <!-- LOGO -->
        <div class="logo-panel">
          <div class="logo">百鬼夜行</div>
          <!-- 调试信息：房间ID和玩家ID -->
          <div v-if="isMultiMode && currentRoomId" class="debug-info" style="font-size: 10px; color: #888; margin-top: 4px; user-select: all;">
            🏠 {{ currentRoomId }} | 👤 {{ myPlayerId }}
          </div>
        </div>
      </div>

      <!-- 中间：鬼王+妖怪+右侧信息 -->
      <div class="mid-row">
        <!-- 鬼王区 -->
        <div class="boss-panel">
          <div class="panel-title">👹 鬼王区</div>
          <div v-if="boss" class="boss-card"
               :class="{
                 'boss-attackable': canAttackBoss,
                 'boss-defeated': isBossDefeated,
                 'boss-hint': allYokaiCleared && !isBossDefeated && state?.turnPhase === 'action'
               }"
               @click="hitBoss"
               @mouseenter="showBossTooltip($event, boss)"
               @mouseleave="hideTooltip">
            <img v-if="getCardImage(boss)" :src="getCardImage(boss)" class="card-art boss-art" />
            <!-- 等待退治/超度选择时 -->
            <div v-if="isBossDefeated" class="boss-defeated-overlay">💀 已击败<br/>请选择...</div>
            <!-- 鬼王信息（顶部渐变） -->
            <div class="boss-info">
              <div class="boss-name">{{boss.name}}</div>
              <div class="boss-stat">
                <span :class="{'hp-damaged': state?.field.bossCurrentHp < boss.hp}">❤️{{state?.field.bossCurrentHp}}/{{boss.hp}}</span>
                <span>👑{{boss.charm||0}}</span>
              </div>
            </div>
          </div>
          <!-- 妖怪全清但伤害不足时的提示 -->
          <div v-if="allYokaiCleared && state?.turnPhase === 'action' && !canAttackBoss && boss"
               class="boss-no-dmg-hint">
            妖怪已清！<br/>积累伤害后攻击鬼王
          </div>
          <!-- 鬼王区底部提示 -->
          <div v-else-if="isFirstBoss" class="boss-tip-first">
            所有未造成击杀的伤害在回合结束时将被移除！
          </div>
          <div v-else class="boss-tip-incoming">
            👹 鬼王来袭！
          </div>
          <div class="boss-remain">剩余:{{state?.field.bossDeck.length||0}}</div>
        </div>
        <div class="yokai-panel">
          <div class="panel-title">👻 游荡妖怪区</div>
          <div class="yokai-grid">
            <div v-for="(y,i) in yokai" :key="i" 
                 class="yokai-card" 
                 :class="{
                   empty: !y, 
                   wounded: y && isWounded(y) && !isKilled(y),
                   canKill: y && canKillYokai(y),
                   killed: y && isKilled(y),
                   selecting: selectingTarget && y
                 }"
                 @click="y && handleYokaiClick(i, y)"
                 @mouseenter="y && showTooltip($event, y)"
                 @mouseleave="hideTooltip">
              <template v-if="y">
                <img v-if="getCardImage(y)" :src="getCardImage(y)" class="card-art yokai-art" />
                <div class="yokai-info">
                  <div class="y-name">{{y.name}}</div>
                  <div class="y-stat">
                    <span :class="{'hp-damaged': getYokaiCurrentHp(y) < getYokaiMaxHp(y)}">❤️{{getYokaiCurrentHp(y)}}/{{getYokaiMaxHp(y)}}</span>
                    <span>👑{{y.charm||0}}</span>
                  </div>
                </div>
                <div v-if="isKilled(y)" class="killed-badge">💀 已击杀</div>
              </template>
            </div>
          </div>
          <div class="yokai-label">游荡妖怪</div>
        </div>
        
        <!-- 右侧信息区 -->
        <div class="info-side-panel">
          <div class="info-box" @click="handleLogLinkClick">
            <div v-for="(l,i) in logs.slice(-8)" :key="i" class="info-line" v-html="renderLogMessage(l)"></div>
          </div>
          <div class="action-buttons">
            <button class="side-btn" :class="{ disabled: !canGetAnySpell }" @click="handleGetSpell">
              获得阴阳术
              <span v-if="recommendSpell && canGetAnySpell" class="recommend-badge">推荐</span>
            </button>
            <button class="side-btn" :class="{ disabled: !(canAcquireShikigami || canReplaceShikigami) }" @click="handleShikigamiAction">
              {{ (player?.shikigami?.length || 0) >= 3 ? '置换式神' : '获得式神' }}
            </button>
            <div class="exile-btn" @click="showExiled=true">
              <span class="exile-count">{{ allExiledCards.length }}</span>
              <span class="exile-label">超度区</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 中部个人信息区 (top:640px) -->
      <div class="personal-info-row">
        <div class="self-info">
          <div class="avatar-box"></div>
          <div class="stat-box">
            <div class="stat-item"><span>👑</span><b>{{player?.totalCharm||0}}</b></div>
            <div class="stat-item"><span>📚</span><b>{{(player?.deck?.length||0)+(player?.hand?.length||0)+(player?.discard?.length||0)+(player?.played?.length||0)}}</b></div>
          </div>
        </div>
        <div class="deck-discard-area">
          <div class="pile-box deck-box" @click="showDeck=true">
            <b>{{player?.deck?.length||0}}</b>
            <span>牌库</span>
          </div>
          <div class="pile-box discard-box" @click="showDiscard=true">
            <b>{{player?.discard?.length||0}}</b>
            <span>弃牌堆</span>
          </div>
        </div>
      </div>

      <!-- 底部：式神+手牌+结束 (top:800px) -->
      <div class="bot-row">
        <!-- 式神区 -->
        <div class="shiki-panel">
          <div class="shiki-label">式神</div>
          <div class="shiki-cards">
            <div v-for="(s,i) in player?.shikigami" :key="s.id" 
                 class="shiki-card" 
                 :class="{tired:player?.shikigamiState[i]?.isExhausted}"
                 @click="useSkill(s.id)"
                 @mouseenter="showShikigamiTooltip($event, s)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(s)" :src="getCardImage(s)" class="card-art shiki-art" />
              <!-- 式神信息（底部渐变） -->
              <div class="shiki-info">
                <div class="shiki-row1">
                  <span class="shiki-name">{{s.name}}</span>
                  <span class="shiki-rarity-tag" :class="'rarity-'+s.rarity?.toLowerCase()">{{s.rarity}}</span>
                </div>
                <div class="shiki-row2">
                  <span v-if="s.passive" class="shiki-skill-label">【触】{{s.passive.name}}</span>
                  <span v-if="s.skill" class="shiki-skill-label">【启】{{s.skill.name}} 🔥{{s.skill.cost||0}}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="ghost-fire-bar">
            <div v-for="i in 5" :key="i" class="fire-slot" :class="{active: i <= (player?.ghostFire||0)}"></div>
          </div>
        </div>
        
        <!-- 手牌区 -->
        <div class="hand-panel">
          <div class="damage-display">
            <span>⚔️</span><b>{{player?.damage||0}}</b>
          </div>
          <div class="hand-label">手牌</div>
          <div class="hand-cards">
            <div v-for="c in player?.hand" :key="c.instanceId" 
                 class="hand-card" 
                 :class="[cardType(c), {selecting: selectingCards, unplayable: !canPlay(c)}]"
                 @click="handleCardClick(c)"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art hand-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat" v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</div>
                <div class="c-stat" v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">
                  <template v-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else>🎁</template>
                </div>
                <div class="c-stat" v-else-if="c.cardType === 'penalty'">💔{{c.charm||0}}</div>
                <div class="c-stat" v-else>—</div>
              </div>
            </div>
          </div>
        </div>
        <div class="end-panel">
          <button class="end-btn" @click="endTurn" :disabled="state?.turnPhase!=='action'">
            结束回合 →
          </button>
          <div class="phase">{{phaseText}}</div>
        </div>
      </div>

      <!-- 弹窗：妖怪刷新确认（只有当前回合玩家可见，且不在式神操作中） -->
      <div class="modal" v-if="state?.pendingYokaiRefresh && isMyTurn && !shikigamiModal.show">
        <div class="modal-box">
          <p>⚠️ 上一玩家未击败妖怪，是否刷新场上妖怪？</p>
          <button class="btn primary" @click="refresh(true)">刷新</button>
          <button class="btn" @click="refresh(false)">保持</button>
        </div>
      </div>
      
      <!-- 弹窗：式神阶段 -->
      <div class="modal" v-else-if="state?.turnPhase==='shikigami'">
        <div class="modal-box">
          <p>📋 式神调整阶段</p>
          <button class="btn primary" @click="confirmShiki">进入行动阶段</button>
        </div>
      </div>

      <!-- 弹窗：操作提示 -->
      <div class="modal" v-if="hintModal.show">
        <div class="modal-box hint-modal">
          <p class="modal-title">{{ hintModal.title }}</p>
          <div class="hint-content">
            <p v-for="(line, i) in hintModal.lines" :key="i">{{ line }}</p>
          </div>
          <button class="confirm-hint-btn" @click="hintModal.show = false">知道了</button>
        </div>
      </div>

      <!-- 弹窗：阴阳术选择 -->
      <div class="modal" v-if="spellSelectModal.show" @click.self="closeSpellModal">
        <div class="modal-box spell-select-modal">
          <p class="modal-title">📜 获得阴阳术</p>
          <p class="spell-modal-hint">选择要获得的阴阳术类型</p>
          <div class="spell-type-list">
            <div v-for="spell in spellOptions" :key="spell.id"
                 class="spell-type-card"
                 :class="{ disabled: !spell.canGet }"
                 @click="spell.canGet && selectSpell(spell.id)">
              <div class="spell-type-header">
                <span class="spell-type-name">{{ spell.name }}</span>
                <span class="spell-type-damage">⚔️{{ spell.damage }}</span>
              </div>
              <div class="spell-type-condition">{{ spell.condition }}</div>
            </div>
          </div>
          <button class="cancel-btn" @click="closeSpellModal">取消</button>
        </div>
      </div>

      <!-- 弹窗：效果选择（CHOICE效果） -->
      <div class="modal" v-if="choiceModal.show">
        <div class="modal-box choice-modal">
          <p class="modal-title">🎯 选择一个效果</p>
          <div class="choice-options">
            <button v-for="(opt, i) in choiceModal.options" :key="i"
                    class="choice-btn" @click="resolveChoice(i)">
              {{opt}}
            </button>
          </div>
        </div>
      </div>

      <!-- 弹窗：卡牌选择（弃牌/超度选择等） -->
      <div class="modal" v-if="cardSelectModal.show">
        <div class="modal-box card-select-modal">
          <p class="modal-title">{{cardSelectModal.title}}</p>
          <p class="modal-hint">{{cardSelectModal.hint || `选择 ${cardSelectModal.count} 张牌`}}</p>
          <div class="card-select-grid">
            <div v-for="c in cardSelectModal.candidates" :key="c.instanceId"
                 class="select-card-item" 
                 :class="[c.cardType, {selected: cardSelectModal.selected.includes(c.instanceId)}]"
                 @click="toggleCardSelect(c.instanceId)"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">❤️{{c.hp}}</div>
              </div>
              <div class="select-check" v-if="cardSelectModal.selected.includes(c.instanceId)">✓</div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn primary" 
                    :disabled="cardSelectModal.selected.length !== cardSelectModal.count"
                    @click="handleCardSelectConfirm">
              确认
            </button>
            <button class="btn secondary" @click="cancelCardSelect" v-if="cardSelectModal.onConfirm">
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- 弹窗：目标选择 -->
      <div class="modal" v-if="targetModal.show">
        <div class="modal-box target-modal">
          <p class="modal-title">🎯 选择目标</p>
          <div class="target-grid">
            <div v-for="c in targetModal.candidates" :key="c.instanceId"
                 class="target-card" @click="resolveTarget(c.instanceId)">
              <div class="c-name">{{c.name}}</div>
              <div class="c-stat">❤️{{c.hp}}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 弹窗：超度区查看（公共区域） -->
      <div class="modal" v-if="showExiled" @click.self="showExiled=false">
        <div class="exiled-panel">
          <h2 class="exiled-title">📜 公共超度区</h2>
          <p class="exiled-hint">所有玩家超度的卡牌（移出游戏，不计入声誉）</p>
          <div class="exiled-card-list" v-if="allExiledCards.length">
            <div v-for="c in allExiledCards" :key="c.instanceId || c.id" 
                 class="exiled-card-item"
                 :class="c.cardType || c.type"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">
                  <template v-if="c.cardType === 'spell' || c.type === 'spell'">⚔️{{c.damage||1}}</template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty' || c.type === 'penalty'">💔{{c.charm||0}}</template>
                  <template v-else>🎁</template>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="empty-hint">暂无超度的卡牌</p>
          <button class="exiled-close-btn" @click="showExiled=false">关闭</button>
        </div>
      </div>

      <!-- 弹窗：牌库查看 -->
      <div class="modal" v-if="showDeck" @click.self="showDeck=false">
        <div class="pile-view-panel">
          <h2 class="pile-view-title">📚 牌库</h2>
          <p class="pile-view-hint">待抽取的卡牌（{{ player?.deck?.length || 0 }}张）</p>
          <div class="pile-card-list" v-if="player?.deck?.length">
            <div v-for="c in player.deck" :key="c.instanceId" 
                 class="pile-card-item"
                 :class="c.cardType"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">
                  <template v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty'">💔{{c.charm||0}}</template>
                  <template v-else>🎁</template>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="empty-hint">牌库为空</p>
          <button class="pile-close-btn" @click="showDeck=false">关闭</button>
        </div>
      </div>

      <!-- 弹窗：弃牌堆查看 -->
      <div class="modal" v-if="showDiscard" @click.self="showDiscard=false">
        <div class="pile-view-panel">
          <h2 class="pile-view-title">🗑️ 弃牌堆</h2>
          <p class="pile-view-hint">已使用的卡牌（{{ player?.discard?.length || 0 }}张）</p>
          <div class="pile-card-list" v-if="player?.discard?.length">
            <div v-for="c in player.discard" :key="c.instanceId" 
                 class="pile-card-item"
                 :class="c.cardType"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">
                  <template v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty'">💔{{c.charm||0}}</template>
                  <template v-else>🎁</template>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="empty-hint">弃牌堆为空</p>
          <button class="pile-close-btn" @click="showDiscard=false">关闭</button>
        </div>
      </div>

      <!-- 弹窗：式神获取/置换 -->
      <div class="modal" v-if="shikigamiModal.show">
        <div class="modal-box shikigami-modal">
          <p class="modal-title">{{ shikigamiModal.isReplace ? '🔄 置换式神' : '🦊 获取式神' }}</p>
          
          <!-- 步骤1：选择超度的阴阳术 -->
          <div v-if="shikigamiModal.step === 1" class="shikigami-step">
            <p class="step-hint" v-if="!shikigamiModal.isReplace">
              选择阴阳术超度（≥5点，必须包含高级符咒）
            </p>
            <p class="step-hint" v-else>
              选择1张高级符咒或专属符咒
            </p>
            <p class="step-info">
              当前已选：{{shikigamiModal.selectedDamage}}点伤害
              <span v-if="!shikigamiModal.isReplace">(需要≥5点+含高级)</span>
              <span v-else>(需要3点)</span>
            </p>
            <div class="spell-select-grid">
              <div v-for="c in spellCardsInHand" :key="c.instanceId"
                   class="spell-select-card" 
                   :class="{selected: shikigamiModal.selectedSpells.includes(c.instanceId)}"
                   @click="toggleSpellForShikigami(c)">
                <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
                <div class="card-info">
                  <div class="c-name">{{c.name}}</div>
                  <div class="c-stat">⚔️{{c.damage||c.hp||1}}</div>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn" @click="closeShikigamiModal">取消</button>
              <button class="btn primary" 
                      :disabled="!isValidShikigamiSelection"
                      @click="nextShikigamiStep">
                下一步
              </button>
            </div>
          </div>

          <!-- 步骤2、3在modal外独立显示 -->
          <template v-else-if="shikigamiModal.step >= 2">
          </template>
        </div>
      </div>

      <!-- 步骤2：选择新式神（2选1）- 独立全屏界面 -->
      <div class="acquire-shikigami-overlay" v-if="shikigamiModal.show && shikigamiModal.step === 2">
        <div class="acquire-shikigami-panel">
          <h2 class="acquire-title">🦊 选择式神</h2>
          <p class="acquire-hint">从下列{{ shikigamiModal.candidates.length }}个式神中选择1个</p>
          
          <div class="acquire-cards">
            <div v-for="s in shikigamiModal.candidates" :key="s.id"
                 class="shikigami-option"
                 :class="{ selected: shikigamiModal.selectedNewId === s.id }"
                 @click="shikigamiModal.selectedNewId = s.id"
                 @mouseenter="showSelectShikigamiTooltip($event, s)"
                 @mouseleave="hideTooltip">
              <div class="shikigami-card-inner">
                <img v-if="getCardImage(s)" :src="getCardImage(s)" class="shikigami-art" />
                <div class="shikigami-overlay">
                  <div class="shikigami-name">{{ s.name }}</div>
                  <div class="shikigami-rarity" :class="'rarity-' + s.rarity?.toLowerCase()">{{ s.rarity }}</div>
                </div>
              </div>
              <div class="select-badge" v-if="shikigamiModal.selectedNewId === s.id">✓</div>
            </div>
          </div>
          
          <button class="acquire-confirm-btn" 
                  :class="{ ready: shikigamiModal.selectedNewId }"
                  :disabled="!shikigamiModal.selectedNewId"
                  @click="confirmNewShikigami">
            {{ shikigamiModal.selectedNewId ? (shikigamiModal.isReplace ? '下一步：选择替换' : '确认获取') : '请选择一个式神' }}
          </button>
        </div>
      </div>

      <!-- 步骤3（置换时）：选择要替换的旧式神 -->
      <div class="acquire-shikigami-overlay" v-if="shikigamiModal.show && shikigamiModal.step === 3 && shikigamiModal.isReplace">
        <div class="acquire-shikigami-panel">
          <h2 class="acquire-title">🔄 选择替换</h2>
          <p class="acquire-hint">选择要替换掉的式神</p>
          
          <div class="acquire-cards">
            <div v-for="s in player?.shikigami" :key="s.id"
                 class="shikigami-option"
                 :class="{ selected: shikigamiModal.selectedOldId === s.id }"
                 @click="shikigamiModal.selectedOldId = s.id"
                 @mouseenter="showSelectShikigamiTooltip($event, s)"
                 @mouseleave="hideTooltip">
              <div class="shikigami-card-inner">
                <img v-if="getCardImage(s)" :src="getCardImage(s)" class="shikigami-art" />
                <div class="shikigami-overlay">
                  <div class="shikigami-name">{{ s.name }}</div>
                  <div class="shikigami-rarity" :class="'rarity-' + s.rarity?.toLowerCase()">{{ s.rarity }}</div>
                </div>
              </div>
              <div class="select-badge" v-if="shikigamiModal.selectedOldId === s.id">✓</div>
            </div>
          </div>
          
          <button class="acquire-confirm-btn" 
                  :class="{ ready: shikigamiModal.selectedOldId }"
                  :disabled="!shikigamiModal.selectedOldId"
                  @click="confirmReplaceShikigami">
            {{ shikigamiModal.selectedOldId ? '确认替换' : '请选择要替换的式神' }}
          </button>
        </div>
      </div>

    </div>

    <!-- 卡牌悬浮提示（全局，始终可用） -->
    <Teleport to="body">
      <div class="card-tooltip" v-if="tooltip.show" :style="tooltipStyle">
        <div class="tooltip-header">
          <span class="tooltip-name">{{tooltip.card?.name}}</span>
          <span class="tooltip-type" :class="tooltip.typeClass">{{tooltip.typeLabel}}</span>
        </div>
        <div class="tooltip-stats" v-if="tooltip.stats">
          <span v-for="(stat, key) in tooltip.stats" :key="key" class="stat-item">
            {{stat.icon}}{{stat.value}}
          </span>
        </div>
        <div class="tooltip-subtype" v-if="tooltip.card?.subtype">
          {{tooltip.card.subtype}}
        </div>
        <div class="tooltip-effect" v-if="tooltip.effect">
          <p v-for="(line, i) in tooltip.effect.split('。').filter((s: string) => s.trim())" :key="i">
            {{line}}。
          </p>
        </div>
        <div class="tooltip-passive" v-if="tooltip.passive">
          <span class="passive-label">【被动】{{tooltip.passive.name}}</span>
          <p>{{tooltip.passive.effect}}</p>
        </div>
        <div class="tooltip-skill" v-if="tooltip.skill">
          <span class="skill-label">【{{tooltip.skill.name}} (🔥{{tooltip.skill.cost}})</span>
          <p>{{tooltip.skill.effect}}</p>
        </div>
      </div>
    </Teleport>
    
    <!-- 日志引用弹出框 -->
    <Teleport to="body">
      <div class="log-ref-popup" v-if="logRefPopup.show" 
           :style="{ left: logRefPopup.x + 'px', top: logRefPopup.y + 'px' }"
           @click.stop>
        <div class="log-ref-close" @click="closeLogRefPopup">×</div>
        <template v-if="logRefPopup.ref">
          <!-- 卡牌类型 -->
          <template v-if="logRefPopup.ref.type === 'card' && logRefPopup.ref.data">
            <div class="log-ref-card">
              <img v-if="getCardImage(logRefPopup.ref.data)" :src="getCardImage(logRefPopup.ref.data)" class="ref-card-img" />
              <div class="ref-card-info">
                <div class="ref-card-name">{{logRefPopup.ref.name}}</div>
                <div class="ref-card-type">{{logRefPopup.ref.data.cardType}}</div>
                <div class="ref-card-stats" v-if="logRefPopup.ref.data.hp">❤️{{logRefPopup.ref.data.hp}}</div>
                <div class="ref-card-stats" v-if="logRefPopup.ref.data.damage">⚔️{{logRefPopup.ref.data.damage}}</div>
              </div>
            </div>
          </template>
          <!-- 式神类型 -->
          <template v-else-if="logRefPopup.ref.type === 'shikigami' && logRefPopup.ref.data">
            <div class="log-ref-shikigami">
              <div class="ref-shikigami-name">🦊 {{logRefPopup.ref.name}}</div>
              <div class="ref-shikigami-skill" v-if="logRefPopup.ref.data.skill">
                【{{logRefPopup.ref.data.skill.name}}】 🔥{{logRefPopup.ref.data.skill.cost}}
              </div>
            </div>
          </template>
          <!-- 鬼王类型 -->
          <template v-else-if="logRefPopup.ref.type === 'boss' && logRefPopup.ref.data">
            <div class="log-ref-boss">
              <div class="ref-boss-name">👹 {{logRefPopup.ref.name}}</div>
              <div class="ref-boss-hp">❤️{{logRefPopup.ref.data.hp}} ⭐{{logRefPopup.ref.data.charm}}</div>
            </div>
          </template>
          <!-- 玩家类型 -->
          <template v-else-if="logRefPopup.ref.type === 'player'">
            <div class="log-ref-player">
              <div class="ref-player-name">👤 {{logRefPopup.ref.name}}</div>
            </div>
          </template>
          <!-- 默认：仅显示名称 -->
          <template v-else>
            <div class="log-ref-default">{{logRefPopup.ref.name}}</div>
          </template>
        </template>
      </div>
      <!-- 点击遮罩关闭弹出框 -->
      <div class="log-ref-overlay" v-if="logRefPopup.show" @click="closeLogRefPopup"></div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SinglePlayerGame } from './game/SinglePlayerGame'
import { socketClient } from './network/SocketClient'
import type { GameState } from '../../shared/types/game'
import type { CardInstance } from '../../shared/types/cards'

// ── 路由与模式 ──────────────────────────────────────
const route = useRoute()
const router = useRouter()
const isMultiMode = computed(() => route.query.mode === 'multi')

// ── 卡牌图片路径映射 ──────────────────────────────────────
// id格式：boss_001 → 101.webp, yokai_001 → 201.webp, shikigami_001 → 401.webp
// spell_001 → 601.webp, penalty_001 → 701.webp
// 图片编号规则（按 妖怪卡.md 文档顺序）：
//   201 = 招福达摩(token_001)
//   202 = 赤舌(yokai_001), 203 = 唐纸伞妖(yokai_002) ... 239 = 三味(yokai_038)
//   101-110 = 鬼王, 401-424 = 式神, 601-603 = 阴阳术, 701-702 = 恶评
function getCardImage(card: CardInstance | any): string {
  const rawId = card?.cardId || card?.id
  if (!rawId) return ''
  const m = String(rawId).match(/^(\w+)_(\d+)$/)
  if (!m) return ''
  const [, type, num] = m
  const n = parseInt(num)

  let path = ''
  if (type === 'token')     path = `/images/yokai/${200 + n}.webp`          // token_001 → 201
  else if (type === 'yokai')     path = `/images/yokai/${201 + n}.webp`     // yokai_001 → 202
  else if (type === 'boss')      path = `/images/bosses/${100 + n}.webp`    // boss_001 → 101
  else if (type === 'shikigami') path = `/images/shikigami/${400 + n}.webp` // shikigami_001 → 401
  else if (type === 'spell')     path = `/images/spells/${600 + n}.webp`    // spell_001 → 601
  else if (type === 'penalty')   path = `/images/curses/${700 + n}.webp`    // penalty_001 → 701

  return path
}

// 禁用全局拖拽默认行为，防止长按出现多选框/图片拖走
onMounted(() => {
  document.addEventListener('dragstart', e => e.preventDefault())
  document.addEventListener('selectstart', e => e.preventDefault())
  document.addEventListener('contextmenu', e => e.preventDefault())
  
  // 禁用Ctrl+滚轮缩放
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
    }
  }, { passive: false })
  
  // 禁用键盘缩放快捷键 Ctrl+Plus/Minus/0
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault()
    }
  })
  
  // 多人模式：检查是否已有游戏状态
  if (isMultiMode.value && socketClient.gameState.value) {
    inGame.value = true
    console.log('[App] 多人模式：检测到游戏状态，直接进入游戏')
  }
})

// 多人模式：监听游戏状态同步
watch(() => socketClient.gameState.value, (newState) => {
  if (isMultiMode.value && newState) {
    console.log('[App] 多人模式：收到状态更新', newState.phase, newState.turnPhase)
    nextTick(() => { if(logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight })
  }
}, { deep: true })

// 多人模式：监听游戏事件（倒计时等）
if (typeof window !== 'undefined') {
  socketClient.on('gameEvent', (event: any) => {
    if (event.type === 'SHIKIGAMI_SELECT_START') {
      // 启动倒计时
      const timeout = event.timeout || 20000
      shikigamiSelectCountdown.value = Math.ceil(timeout / 1000)
      
      // 清除旧的定时器
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }
      
      // 每秒减少
      countdownInterval = window.setInterval(() => {
        if (shikigamiSelectCountdown.value > 0) {
          shikigamiSelectCountdown.value--
        } else {
          if (countdownInterval) {
            clearInterval(countdownInterval)
            countdownInterval = null
          }
        }
      }, 1000)
    }
  })
}

// 组件卸载时的清理
onUnmounted(() => {
  // 清除倒计时
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
})

const playerName = ref('阴阳师')
const inGame = ref(false)
const localState = ref<GameState|null>(null)
let game: SinglePlayerGame|null = null
const logRef = ref<HTMLElement|null>(null)

// 统一的游戏状态：多人模式用 socketClient.gameState，单人模式用 localState
const state = computed(() => {
  if (isMultiMode.value) {
    return socketClient.gameState.value
  }
  return localState.value
})

// 当前玩家ID（多人模式从 socketClient 获取）
const myPlayerId = computed(() => {
  if (isMultiMode.value) {
    return socketClient.playerId.value
  }
  return 'player_0' // 单人模式固定玩家ID
})

// 当前房间ID（用于调试显示）
const currentRoomId = computed(() => {
  return socketClient.currentRoom.value?.id || ''
})

// 当前玩家在数组中的索引
const myPlayerIndex = computed(() => {
  if (!state.value) return 0
  return state.value.players.findIndex(p => p.id === myPlayerId.value)
})

// 所有玩家列表（按行动顺序）
const allPlayers = computed(() => {
  return state.value?.players || []
})

// 选择相关状态
const showExiled = ref(false)
const showDeck = ref(false)
const showDiscard = ref(false)
const selectingTarget = ref(false)
const selectingCards = ref(false)

// 多人模式：式神选择倒计时
const shikigamiSelectCountdown = ref(0)
let countdownInterval: number | null = null

// 悬浮提示状态
const tooltip = reactive<{
  show: boolean
  card: CardInstance | null
  x: number
  y: number
  typeLabel: string
  typeClass: string
  stats: Record<string, {icon: string, value: number | string}> | null
  effect: string
  passive: {name: string, effect: string} | null
  skill: {name: string, cost: number, effect: string} | null
}>({
  show: false,
  card: null,
  x: 0,
  y: 0,
  typeLabel: '',
  typeClass: '',
  stats: null,
  effect: '',
  passive: null,
  skill: null
})

// 操作提示弹窗
const hintModal = reactive<{
  show: boolean
  title: string
  lines: string[]
}>({
  show: false,
  title: '',
  lines: []
})

function showHint(title: string, lines: string[]) {
  hintModal.title = title
  hintModal.lines = lines
  hintModal.show = true
}

// 效果选择弹窗
const choiceModal = reactive<{
  show: boolean
  options: string[]
  resolve: ((index: number) => void) | null
}>({
  show: false,
  options: [],
  resolve: null
})

// 卡牌选择弹窗
const cardSelectModal = reactive<{
  show: boolean
  title: string
  hint: string
  candidates: CardInstance[]
  count: number
  selected: string[]
  resolve: ((ids: string[]) => void) | null
  onConfirm: (() => void) | null
}>({
  show: false,
  title: '选择卡牌',
  hint: '',
  candidates: [],
  count: 1,
  selected: [],
  resolve: null,
  onConfirm: null
})

// 目标选择弹窗
const targetModal = reactive<{
  show: boolean
  candidates: CardInstance[]
  resolve: ((id: string) => void) | null
}>({
  show: false,
  candidates: [],
  resolve: null
})

// 式神获取/置换弹窗
const shikigamiModal = reactive<{
  show: boolean
  isReplace: boolean
  step: number  // 1=选卡, 2=选新式神, 3=选旧式神(仅置换)
  selectedSpells: string[]
  selectedDamage: number
  oldShikigamiId: string
  candidates: any[]  // 抽到的式神
  selectingOld: boolean
  selectedNewId: string  // 选中的新式神ID
  selectedOldId: string  // 选中的旧式神ID（置换时）
}>({
  show: false,
  isReplace: false,
  step: 1,
  selectedSpells: [],
  selectedDamage: 0,
  oldShikigamiId: '',
  candidates: [],
  selectingOld: false,
  selectedNewId: '',
  selectedOldId: ''
})

// 当前玩家数据：多人模式使用 myPlayerIndex，单人模式固定用 players[0]
const player = computed(() => {
  if (!state.value) return undefined
  if (isMultiMode.value) {
    return state.value.players[myPlayerIndex.value]
  }
  return state.value.players[0]
})

// 是否轮到自己行动
const isMyTurn = computed(() => {
  if (!state.value) return false
  if (isMultiMode.value) {
    return state.value.currentPlayerIndex === myPlayerIndex.value
  }
  return true // 单人模式始终是自己的回合
})
const yokai = computed(() => state.value?.field.yokaiSlots || [])
const boss = computed(() => state.value?.field.currentBoss)
const logs = computed(() => (state.value?.log || []).slice(-6))

// 日志引用对象点击状态
const logRefPopup = ref<{
  show: boolean;
  ref: any;
  x: number;
  y: number;
}>({ show: false, ref: null, x: 0, y: 0 })

// 渲染日志消息（解析超链接）
function renderLogMessage(log: any): string {
  if (!log.refs || Object.keys(log.refs).length === 0) {
    // 没有引用，直接返回纯文本（转义HTML）
    return escapeHtml(log.message)
  }
  
  // 解析 {type:name} 格式的占位符
  let html = escapeHtml(log.message)
  for (const [placeholder, ref] of Object.entries(log.refs as Record<string, any>)) {
    const pattern = `{${placeholder}}`
    const escapedPattern = escapeHtml(pattern)
    const link = `<span class="log-link" data-ref-key="${placeholder}">${escapeHtml(ref.name)}</span>`
    html = html.replace(escapedPattern, link)
  }
  
  return html
}

// 转义HTML特殊字符
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 处理日志超链接点击
function handleLogLinkClick(event: Event) {
  const target = event.target as HTMLElement
  if (!target.classList.contains('log-link')) return
  
  const refKey = target.dataset.refKey
  if (!refKey) return
  
  // 从最近的日志中查找引用对象
  const recentLogs = logs.value
  for (const log of recentLogs) {
    if (log.refs && log.refs[refKey]) {
      const ref = log.refs[refKey]
      showLogRefPopup(event, ref)
      return
    }
  }
}

// 显示引用对象弹出框
function showLogRefPopup(event: Event, ref: any) {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  
  // 计算弹出位置（在点击位置附近，考虑边界）
  let x = rect.left
  let y = rect.bottom + 5
  
  // 边界检测（假设弹出框宽度200，高度150）
  const popupWidth = 200
  const popupHeight = 150
  
  if (x + popupWidth > window.innerWidth) {
    x = window.innerWidth - popupWidth - 10
  }
  if (y + popupHeight > window.innerHeight) {
    y = rect.top - popupHeight - 5
  }
  
  logRefPopup.value = {
    show: true,
    ref,
    x,
    y
  }
}

// 关闭引用弹出框
function closeLogRefPopup() {
  logRefPopup.value.show = false
}

const canSpell = computed(() => {
  // 多人模式下检查远程状态
  if (isMultiMode.value && state.value) {
    if (!isMyTurn.value) return false
    if (state.value.turnPhase !== 'action') return false
    // 检查本回合是否已获取过基础术式
    return !(player.value as any)?.hasGainedBasicSpell
  }
  // 单人模式
  return game?.canGainBasicSpell() ?? false
})

// 公共超度区：合并所有来源的超度卡牌
const allExiledCards = computed(() => {
  const fieldExile = state.value?.field?.exileZone || []
  const playerExile = player.value?.exiled || []
  return [...fieldExile, ...playerExile]
})

// 推荐获得阴阳术：牌库中阴阳术总伤害<11时
const recommendSpell = computed(() => {
  const p = player.value
  if (!p) return false
  
  // 统计牌库中所有阴阳术的总伤害值（deck + hand + discard）
  const allCards = [...(p.deck || []), ...(p.hand || []), ...(p.discard || [])]
  const spellDamage = allCards
    .filter(c => c.cardType === 'spell')
    .reduce((sum, c) => sum + (c.damage || 1), 0)
  
  return spellDamage < 11
})

// 式神获取/置换相关 - 依赖 state 触发响应式更新
// 规则：获取式神需要≥5点符咒伤害，且至少有1张高级符咒（伤害=3）
// 规则：置换式神需要恰好1张高级符咒（伤害=3），且已有3个式神
const canAcquireShikigami = computed(() => {
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value) return false
    if (state.value?.turnPhase !== 'action') return false
    const p = player.value
    if (!p) return false
    // 检查是否已有3只式神（达到上限）
    if ((p.shikigami?.length || 0) >= 3) return false
    // 检查手牌中的符咒
    const spells = (p.hand || []).filter(c => c.cardType === 'spell')
    const spellDamage = spells.reduce((sum, c) => sum + (c.damage || 1), 0)
    const hasAdvanced = spells.some(c => c.damage === 3)
    // 需要≥5点伤害 且 包含高级符咒
    return spellDamage >= 5 && hasAdvanced
  }
  // 单人模式
  return game?.canAcquireShikigami() ?? false
})
const canReplaceShikigami = computed(() => {
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value) return false
    if (state.value?.turnPhase !== 'action') return false
    const p = player.value
    if (!p) return false
    // 检查是否有3个式神（只有满了才能置换）
    if ((p.shikigami?.length || 0) !== 3) return false
    // 检查手牌中是否有高级符咒（伤害=3）
    const hasAdvanced = (p.hand || []).some(c => c.cardType === 'spell' && c.damage === 3)
    return hasAdvanced
  }
  // 单人模式
  return game?.canReplaceShikigami() ?? false
})
// 手牌中的符咒卡（直接从响应式状态获取）
const spellCardsInHand = computed(() => {
  const hand = player.value?.hand || []
  return hand.filter(c => c.cardType === 'spell')
})

// 验证当前选择是否有效
const isValidShikigamiSelection = computed(() => {
  if (shikigamiModal.isReplace) {
    // 置换：必须选择恰好1张高级符咒（伤害=3）
    return shikigamiModal.selectedSpells.length === 1 && shikigamiModal.selectedDamage === 3
  } else {
    // 获取：必须≥5点，且包含高级符咒
    if (shikigamiModal.selectedDamage < 5) return false
    // 检查是否包含高级符咒
    const selectedCards = shikigamiModal.selectedSpells
      .map(id => player.value?.hand?.find(c => c.instanceId === id))
      .filter(c => c !== undefined)
    return selectedCards.some(c => (c?.damage || 1) === 3)
  }
})

// 活跃的临时Buff
const activeBuffs = computed(() => {
  const buffs: {type: string, label: string}[] = []
  const tempBuffs = player.value?.tempBuffs || []
  for (const b of tempBuffs) {
    if (b.type === 'SPELL_DAMAGE_BOOST') {
      buffs.push({ type: b.type, label: `⚔️+${b.value}(${b.remainingUses || b.remainingCount || '∞'})` })
    } else if (b.type === 'DOUBLE_YOKAI_EFFECT') {
      buffs.push({ type: b.type, label: '御魂x2' })
    } else if (b.type === 'KILL_TO_HAND') {
      buffs.push({ type: b.type, label: '退治→手牌' })
    } else if (b.type === 'COST_REDUCTION') {
      buffs.push({ type: b.type, label: `🔥-${b.value}` })
    }
  }
  return buffs
})

const phaseText = computed(() => {
  const p = state.value?.turnPhase
  if(p==='ghostFire') return '🔥鬼火'
  if(p==='shikigami') return '🦊式神'
  if(p==='action') return '⚔️行动'
  if(p==='cleanup') return '🧹清理'
  return ''
})

// 悬浮提示样式计算（带边缘碰撞检测）
const tooltipStyle = computed(() => {
  const tooltipWidth = 240  // 估算提示框宽度
  const tooltipHeight = 180 // 估算提示框高度
  const margin = 10         // 边缘安全距离
  
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let left = tooltip.x + 15
  let top = tooltip.y + 10
  
  // 右边缘碰撞：向左显示
  if (left + tooltipWidth > viewportWidth - margin) {
    left = tooltip.x - tooltipWidth - 15
  }
  
  // 下边缘碰撞：向上显示
  if (top + tooltipHeight > viewportHeight - margin) {
    top = tooltip.y - tooltipHeight - 10
  }
  
  // 左边缘碰撞：贴左边
  if (left < margin) {
    left = margin
  }
  
  // 上边缘碰撞：贴上边
  if (top < margin) {
    top = margin
  }
  
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

// ── 从卡牌效果文本解析图标 ──────────────────────────────────────
// 根据effect文本解析出效果（伤害+N、鬼火+N、抓牌+N）
// 图标：⚔️伤害 🔥鬼火 🎴抓牌
function parseCardEffects(card: any): Array<{icon: string, value: number | string}> {
  const effect = card.effect || ''
  const results: Array<{icon: string, value: number | string}> = []
  
  // 匹配 伤害+数字 或 伤害+X 等模式
  const damageMatch = effect.match(/伤害\+(\d+|[XN])/g)
  if (damageMatch) {
    damageMatch.forEach((m: string) => {
      const val = m.replace('伤害+', '')
      results.push({ icon: '⚔️', value: isNaN(Number(val)) ? val : Number(val) })
    })
  }
  
  // 匹配 鬼火+数字 或 鬼火+X
  const fireMatch = effect.match(/鬼火\+(\d+|[XN])/g)
  if (fireMatch) {
    fireMatch.forEach((m: string) => {
      const val = m.replace('鬼火+', '')
      results.push({ icon: '🔥', value: isNaN(Number(val)) ? val : Number(val) })
    })
  }
  
  // 匹配 抓牌+数字 或 抓牌+X
  const drawMatch = effect.match(/抓牌\+(\d+|[XN])/g)
  if (drawMatch) {
    drawMatch.forEach((m: string) => {
      const val = m.replace('抓牌+', '')
      results.push({ icon: '🎴', value: isNaN(Number(val)) ? val : Number(val) })
    })
  }
  
  // 最多返回3组效果
  return results.slice(0, 3)
}

// 获取卡牌在手牌中显示的效果图标（用于tooltip）
function getCardEffectStats(card: any): Record<string, {icon: string, value: number | string}> | null {
  const effects = parseCardEffects(card)
  if (effects.length === 0) return null
  
  const stats: Record<string, {icon: string, value: number | string}> = {}
  effects.forEach((e, i) => {
    stats[`effect${i}`] = e
  })
  return stats
}

// 获取手牌卡片上显示的效果图标数组（用于卡片UI）
function getHandCardEffects(card: any): Array<{icon: string, value: number | string}> {
  return parseCardEffects(card)
}

// 显示卡牌悬浮提示
function showTooltip(event: MouseEvent, card: CardInstance) {
  tooltip.card = card
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  // 根据卡牌类型设置不同信息
  const cardType = card.cardType || card.type
  
  if (cardType === 'spell') {
    tooltip.typeLabel = '阴阳术'
    tooltip.typeClass = 'type-spell'
    tooltip.stats = {
      damage: { icon: '⚔️', value: card.damage || 1 }
    }
    tooltip.effect = card.effect || `造成 ${card.damage || 1} 点伤害`
    tooltip.passive = null
    tooltip.skill = null
  } else if (cardType === 'yokai' || cardType === 'token') {
    tooltip.typeLabel = cardType === 'yokai' ? '御魂' : '令牌'
    tooltip.typeClass = cardType === 'yokai' ? 'type-yokai' : 'type-token'
    // 在手牌/牌库/弃牌堆中显示效果图标，而非血量
    tooltip.stats = getCardEffectStats(card)
    tooltip.effect = card.effect || (cardType === 'token' ? '可用于超度' : '无特殊效果')
    tooltip.passive = null
    tooltip.skill = null
  } else if (cardType === 'penalty') {
    tooltip.typeLabel = '恶评'
    tooltip.typeClass = 'type-penalty'
    tooltip.stats = {
      charm: { icon: '👑', value: card.charm || -1 }
    }
    tooltip.effect = card.effect || '负面声誉'
    tooltip.passive = null
    tooltip.skill = null
  } else {
    tooltip.typeLabel = cardType || '卡牌'
    tooltip.typeClass = ''
    tooltip.stats = null
    tooltip.effect = card.effect || ''
    tooltip.passive = null
    tooltip.skill = null
  }
  
  tooltip.show = true
}

// 显示式神悬浮提示
function showShikigamiTooltip(event: MouseEvent, shikigami: any) {
  tooltip.card = shikigami
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  tooltip.typeLabel = shikigami.rarity || 'SR'
  tooltip.typeClass = `rarity-${(shikigami.rarity || 'SR').toLowerCase()}`
  tooltip.stats = {
    charm: { icon: '👑', value: shikigami.charm || 2 }
  }
  
  // 只有被动时显示在effect区域，有主动时分开显示
  if (shikigami.passive && !shikigami.skill) {
    tooltip.effect = `【被动】${shikigami.passive.name}：${shikigami.passive.effect}`
    tooltip.passive = null
    tooltip.skill = null
  } else {
    tooltip.effect = ''
    tooltip.passive = shikigami.passive || null
    tooltip.skill = shikigami.skill || null
  }
  
  tooltip.show = true
}

// 显示鬼王悬浮提示
function showBossTooltip(event: MouseEvent, boss: any) {
  tooltip.card = boss
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  tooltip.typeLabel = '鬼王'
  tooltip.typeClass = 'type-boss'
  tooltip.stats = {
    hp: { icon: '❤️', value: `${state.value?.field.bossCurrentHp || boss.hp}/${boss.hp}` },
    charm: { icon: '👑', value: boss.charm || 0 }
  }
  tooltip.effect = boss.arrivalEffect || boss.effect || '击败后获得声誉'
  tooltip.passive = null
  tooltip.skill = null
  
  tooltip.show = true
}

// 隐藏悬浮提示
function hideTooltip() {
  tooltip.show = false
}

// ============ 式神选取阶段 ============

// 可选的式神列表
const shikigamiOptions = computed(() => {
  const allOptions = (state.value as any)?.shikigamiOptions || []
  
  // 多人模式：根据自己的 playerIndex 取对应的4个式神
  if (isMultiMode.value && allOptions.length > 4) {
    const idx = myPlayerIndex.value
    if (idx >= 0) {
      const start = idx * 4
      const end = start + 4
      return allOptions.slice(start, end)
    }
    return []
  }
  
  // 单人模式：直接返回全部（只有4个）
  return allOptions
})

// 已选择的式神列表
const selectedShikigami = computed(() => {
  if (isMultiMode.value) {
    // 多人模式：从当前玩家的 selectedShikigami 读取
    return player.value?.selectedShikigami || []
  }
  // 单人模式：从 state.selectedShikigami 读取
  return (state.value as any)?.selectedShikigami || []
})

// 当前玩家是否已确认式神选择（多人模式）
const isWaitingOthers = computed(() => {
  if (!isMultiMode.value) return false
  return player.value?.isReady === true
})

// 式神确认按钮文案
const shikigamiConfirmButtonText = computed(() => {
  if (isWaitingOthers.value) {
    // 统计还有几人未确认
    const players = state.value?.players || []
    const notReady = players.filter((p: any) => !p.isReady).length
    return `⏳ 等待其他玩家确认 (${notReady}人)`
  }
  if (selectedShikigami.value.length >= 2) {
    return '✅ 确认选择'
  }
  return `确认选择 (${selectedShikigami.value.length}/2)`
})

// 检查式神是否已被选中
function isShikigamiSelected(shikigamiId: string): boolean {
  return selectedShikigami.value.some((s: any) => s.id === shikigamiId)
}

// 切换式神选择
function toggleShikigamiSelection(shikigamiId: string) {
  if (isMultiMode.value) {
    // 多人模式：发送到服务器
    if (isShikigamiSelected(shikigamiId)) {
      socketClient.sendAction({ type: 'deselectShikigami', shikigamiId })
    } else {
      socketClient.sendAction({ type: 'selectShikigami', shikigamiId })
    }
  } else {
    // 单人模式：本地处理
    if (!game) return
    if (isShikigamiSelected(shikigamiId)) {
      game.deselectShikigami(shikigamiId)
    } else {
      game.selectShikigami(shikigamiId)
    }
  }
}

// 取消选择式神
function deselectShikigami(shikigamiId: string) {
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'deselectShikigami', shikigamiId })
  } else {
    if (!game) return
    game.deselectShikigami(shikigamiId)
  }
}

// 确认式神选择
function confirmShikigamiSelection() {
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'confirmShikigamiSelection' })
  } else {
    if (!game) return
    game.confirmShikigamiSelection()
  }
}

// 式神选取阶段的悬浮提示（详细技能展示）
function showSelectShikigamiTooltip(event: MouseEvent, shikigami: any) {
  tooltip.card = shikigami
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  tooltip.typeLabel = shikigami.rarity || 'SR'
  tooltip.typeClass = `rarity-${(shikigami.rarity || 'SR').toLowerCase()}`
  tooltip.stats = {
    charm: { icon: '👑', value: shikigami.charm || 2 }
  }
  
  // 构建完整技能描述
  if (shikigami.skill) {
    const typeLabel = shikigami.skill.type === 'active' ? '启' : 
                      shikigami.skill.type === 'trigger' ? '触' : '永'
    tooltip.effect = ''
    tooltip.passive = shikigami.passive || null
    tooltip.skill = {
      name: `${typeLabel}】${shikigami.skill.name}`,
      cost: shikigami.skill.cost || 0,
      effect: shikigami.skill.description || shikigami.skill.effect || ''
    }
  } else if (shikigami.passive) {
    tooltip.effect = `【被动】${shikigami.passive.name}：${shikigami.passive.effect}`
    tooltip.passive = null
    tooltip.skill = null
  } else {
    tooltip.effect = shikigami.effect || ''
    tooltip.passive = null
    tooltip.skill = null
  }
  
  tooltip.show = true
}

function startGame() {
  // 多人模式下不创建本地游戏实例，状态由服务器同步
  if (isMultiMode.value) {
    inGame.value = true
    return
  }
  
  // 单人模式：创建本地游戏实例
  game = new SinglePlayerGame(playerName.value||'阴阳师', s => {
    localState.value = s
    nextTick(() => { if(logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight })
  })
  
  // 绑定选择回调
  game.onChoiceRequired = async (options: string[]) => {
    return new Promise<number>((resolve) => {
      choiceModal.show = true
      choiceModal.options = options
      choiceModal.resolve = resolve
    })
  }
  
  game.onSelectCardsRequired = async (candidates: CardInstance[], count: number) => {
    return new Promise<string[]>((resolve) => {
      cardSelectModal.show = true
      cardSelectModal.title = count > 1 ? `选择 ${count} 张牌` : '选择一张牌'
      cardSelectModal.candidates = candidates
      cardSelectModal.count = count
      cardSelectModal.selected = []
      cardSelectModal.resolve = resolve
    })
  }
  
  game.onSelectTargetRequired = async (candidates: CardInstance[]) => {
    return new Promise<string>((resolve) => {
      targetModal.show = true
      targetModal.candidates = candidates
      targetModal.resolve = resolve
    })
  }
  
  // 不再直接调用 game.startGame()
  // 玩家需要先在 shikigamiSelect 阶段选择式神
  // 选择完成后由 confirmShikigamiSelection() 触发 game.startGame()
  inGame.value = true
}

// 选择弹窗处理
function resolveChoice(index: number) {
  if (choiceModal.resolve) {
    choiceModal.resolve(index)
    choiceModal.show = false
    choiceModal.resolve = null
  }
}

function toggleCardSelect(id: string) {
  const idx = cardSelectModal.selected.indexOf(id)
  if (idx >= 0) {
    cardSelectModal.selected.splice(idx, 1)
  } else if (cardSelectModal.selected.length < cardSelectModal.count) {
    cardSelectModal.selected.push(id)
  }
}

function resolveCardSelect() {
  if (cardSelectModal.resolve && cardSelectModal.selected.length === cardSelectModal.count) {
    cardSelectModal.resolve([...cardSelectModal.selected])
    cardSelectModal.show = false
    cardSelectModal.resolve = null
  }
}

function handleCardSelectConfirm() {
  console.log('[DEBUG] handleCardSelectConfirm called')
  console.log('[DEBUG] selected:', cardSelectModal.selected)
  console.log('[DEBUG] onConfirm:', cardSelectModal.onConfirm)
  
  // 如果有onConfirm回调，使用它；否则使用resolve
  if (cardSelectModal.onConfirm) {
    console.log('[DEBUG] calling onConfirm...')
    cardSelectModal.onConfirm()
    cardSelectModal.onConfirm = null
  } else {
    console.log('[DEBUG] calling resolveCardSelect...')
    resolveCardSelect()
  }
}

function resolveTarget(id: string) {
  if (targetModal.resolve) {
    targetModal.resolve(id)
    targetModal.show = false
    targetModal.resolve = null
  }
}

// 游戏操作
function handleCardClick(c: CardInstance) {
  console.log('[handleCardClick] 点击卡牌:', c.name, c.instanceId)
  console.log('[handleCardClick] isMyTurn:', isMyTurn.value)
  console.log('[handleCardClick] currentPlayerIndex:', state.value?.currentPlayerIndex)
  console.log('[handleCardClick] myPlayerIndex:', myPlayerIndex.value)
  console.log('[handleCardClick] myPlayerId:', myPlayerId.value)
  console.log('[handleCardClick] turnPhase:', state.value?.turnPhase)
  
  if (selectingCards.value || cardSelectModal.show) {
    console.log('[handleCardClick] 选择模式，忽略')
    return
  }
  if (!isMyTurn.value) {
    console.log('[handleCardClick] 不是我的回合，忽略')
    return
  }
  
  if (isMultiMode.value) {
    console.log('[handleCardClick] 多人模式，发送 playCard')
    socketClient.sendAction({ type: 'playCard', cardInstanceId: c.instanceId })
      .then(() => console.log('[handleCardClick] 发送成功'))
      .catch(e => console.error('[handleCardClick] 发送失败:', e))
  } else {
    game?.playCard(c.instanceId)
  }
}

async function handleYokaiClick(i: number, y: CardInstance) {
  if (selectingTarget.value || targetModal.show) return // 选择模式下走弹窗
  if (!isMyTurn.value) return
  
  // 检查妖怪是否已被击杀
  if (isKilled(y)) {
    // 已击杀：弹出退治/超度选择
    const choice = await new Promise<number>(resolve => {
      choiceModal.show = true
      choiceModal.options = [`退治【${y.name}】（放入弃牌堆）`, `超度【${y.name}】（移出游戏）`]
      choiceModal.resolve = resolve
    })
    
    if (isMultiMode.value) {
      if (choice === 0) {
        socketClient.sendAction({ type: 'retireYokai', slotIndex: i })
      } else {
        socketClient.sendAction({ type: 'banishYokai', slotIndex: i })
      }
    } else {
      if (choice === 0) {
        await game?.retireYokai(i)
      } else {
        game?.banishYokai(i)
      }
    }
  } else {
    // 未击杀：分配伤害
    if (isMultiMode.value) {
      socketClient.sendAction({ type: 'allocateDamage', slotIndex: i })
    } else {
      await game?.allocateDamage(i)
    }
  }
}

function play(id: string) {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'playCard', cardInstanceId: id })
  } else {
    game?.playCard(id)
  }
}

async function kill(i: number) {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'allocateDamage', slotIndex: i })
  } else {
    await game?.allocateDamage(i)
  }
}

// 妖怪状态辅助函数
function getYokaiCurrentHp(y: CardInstance): number {
  // 优先使用currentHp，否则使用hp（服务端格式）
  return y.currentHp !== undefined ? y.currentHp : (y.hp || 0)
}

function getYokaiMaxHp(y: CardInstance): number {
  // 优先使用maxHp，否则检查原始卡牌数据
  return y.maxHp !== undefined ? y.maxHp : (y.hp || 0)
}
function isKilled(y: CardInstance): boolean {
  // 服务端使用hp字段，客户端可能用currentHp
  const hp = y.currentHp !== undefined ? y.currentHp : (y.hp || 0)
  return hp <= 0
}
function isWounded(y: CardInstance): boolean {
  // 已受伤：当前HP < 最大HP
  const currentHp = getYokaiCurrentHp(y)
  const maxHp = getYokaiMaxHp(y)
  return currentHp < maxHp && currentHp > 0
}
function canKillYokai(y: CardInstance): boolean {
  // 玩家伤害足以击杀该妖怪（伤害 >= 剩余HP）
  const currentHp = getYokaiCurrentHp(y)
  return (player.value?.damage || 0) >= currentHp && currentHp > 0
}
function canDamage(y: CardInstance): boolean {
  // 玩家有伤害且妖怪未被击杀
  return (player.value?.damage || 0) > 0 && !isKilled(y)
}
// 妖怪区是否全部清空（可攻击鬼王）
const allYokaiCleared = computed(() =>
  state.value?.field.yokaiSlots.every(s => s === null) ?? false
)
// 是否是第一只鬼王（麒麟）
const isFirstBoss = computed(() => {
  const bossDeckLength = state.value?.field.bossDeck?.length || 0
  // 初始有9只鬼王在牌堆，当前场上1只，所以第一只时牌堆还有9只
  return bossDeckLength >= 9
})
// 是否处于鬼王被击败等待选择状态
const isBossDefeated = computed(() =>
  (state.value?.turnPhase as any) === 'bossDefeated'
)
// 鬼王是否可以被攻击
const canAttackBoss = computed(() => {
  const p = player.value
  return state.value?.turnPhase === 'action'
    && !!state.value?.field.currentBoss
    && (p?.damage ?? 0) > 0
})

function hitBoss() {
  if (!canAttackBoss.value) return
  if (!isMyTurn.value) return // 多人模式：只有自己回合才能操作
  
  const d = player.value?.damage || 0
  if (d > 0) {
    if (isMultiMode.value) {
      socketClient.sendAction({ type: 'attackBoss', damage: d })
    } else {
      game?.attackBoss(d)
    }
  }
}

function useSkill(id: string) {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'useShikigamiSkill', shikigamiId: id })
  } else {
    game?.useShikigamiSkill(id)
  }
}
// 阴阳术选择弹窗
const spellSelectModal = reactive({
  show: false
})

// 中级符咒条件：手牌有基础术式 + 弃牌堆有生命≥2的妖怪 + 本回合未获得过
const canGetMediumSpell = computed(() => {
  const p = player.value
  if (!p) return false
  
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value || state.value?.turnPhase !== 'action') return false
    if ((p as any).hasGainedMediumSpell) return false
    const hasBasicSpell = (p.hand || []).some(c => c.cardId === 'spell_001' || c.cardId === 'basic_spell' || c.name === '基础术式')
    const hasYokaiHp2 = (p.discard || []).some(c => (c.cardType === 'yokai' || c.cardType === 'token') && (c.hp || 0) >= 2)
    return hasBasicSpell && hasYokaiHp2
  }
  
  // 单人模式
  if (!game) return false
  if (!game.canExchangeMediumSpell()) return false  // 本回合已获得过
  const hasBasicSpell = p.hand.some(c => c.cardId === 'spell_001' || c.name === '基础术式')
  const hasYokaiHp2 = p.discard.some(c => (c.cardType === 'yokai' || c.cardType === 'token') && (c.hp || 0) >= 2)
  return hasBasicSpell && hasYokaiHp2
})

// 高级符咒条件：手牌有中级符咒 + 弃牌堆有生命≥4的妖怪 + 本回合未获得过
const canGetAdvancedSpell = computed(() => {
  const p = player.value
  if (!p) return false
  
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value || state.value?.turnPhase !== 'action') return false
    if ((p as any).hasGainedAdvancedSpell) return false
    const hasMediumSpell = (p.hand || []).some(c => c.cardId === 'spell_002' || c.name === '中级符咒')
    const hasYokaiHp4 = (p.discard || []).some(c => (c.cardType === 'yokai' || c.cardType === 'token') && (c.hp || 0) >= 4)
    return hasMediumSpell && hasYokaiHp4
  }
  
  // 单人模式
  if (!game) return false
  if (!game.canExchangeAdvancedSpell()) return false  // 本回合已获得过
  const hasMediumSpell = p.hand.some(c => c.cardId === 'spell_002' || c.name === '中级符咒')
  const hasYokaiHp4 = p.discard.some(c => (c.cardType === 'yokai' || c.cardType === 'token') && (c.hp || 0) >= 4)
  return hasMediumSpell && hasYokaiHp4
})

// 是否有任何阴阳术可获取（用于按钮高亮）
const canGetAnySpell = computed(() => {
  return canSpell.value || canGetMediumSpell.value || canGetAdvancedSpell.value
})

// 使用 computed 让 spellOptions 响应式更新
const spellOptions = computed(() => [
  { 
    id: 'basic', 
    name: '基础术式', 
    damage: 1, 
    condition: canSpell.value ? '✅ 每回合可免费获得1张' : '❌ 本回合已获得过',
    canGet: canSpell.value
  },
  { 
    id: 'medium', 
    name: '中级符咒', 
    damage: 2, 
    condition: canGetMediumSpell.value 
      ? '✅ 超度基础术式 + 弃牌堆妖怪(hp≥2)' 
      : '❌ 超度1张基础术式 + 弃牌堆中1张生命≥2的妖怪',
    canGet: canGetMediumSpell.value
  },
  { 
    id: 'advanced', 
    name: '高级符咒', 
    damage: 3, 
    condition: canGetAdvancedSpell.value 
      ? '✅ 超度中级符咒 + 弃牌堆妖怪(hp≥4)' 
      : '❌ 超度1张中级符咒 + 弃牌堆中1张生命≥4的妖怪',
    canGet: canGetAdvancedSpell.value
  }
])

// GM指令：添加测试卡牌
function gmAddTestCards() {
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'gmAddTestCards' })
    console.log('[GM] 发送添加测试卡牌指令')
  }
}

function handleGetSpell() {
  // 打开阴阳术选择弹窗
  spellSelectModal.show = true
}

// 兑换阴阳术的状态
const spellExchangeState = reactive({
  type: '' as 'medium' | 'advanced' | '',  // 正在兑换的类型
  step: 0,  // 0=未开始, 1=选择弃牌堆妖怪
})

function selectSpell(spellId: string) {
  if (spellId === 'basic') {
    if (canSpell.value) {
      if (isMultiMode.value) {
        socketClient.sendAction({ type: 'gainBasicSpell' })
      } else {
        game?.gainBasicSpell()
      }
      spellSelectModal.show = false
    }
  } else if (spellId === 'medium' && canGetMediumSpell.value) {
    // 开始中级符咒兑换流程
    startSpellExchange('medium')
  } else if (spellId === 'advanced' && canGetAdvancedSpell.value) {
    // 开始高级符咒兑换流程
    startSpellExchange('advanced')
  }
}

function startSpellExchange(type: 'medium' | 'advanced') {
  spellSelectModal.show = false
  spellExchangeState.type = type
  spellExchangeState.step = 1
  
  const p = player.value
  if (!p) return
  
  // 设置需要的条件
  const requiredHp = type === 'medium' ? 2 : 4
  
  // 找到符合条件的弃牌堆妖怪（深拷贝避免影响原数据）
  const validYokai = p.discard
    .filter(c => (c.cardType === 'yokai' || c.cardType === 'token') && (c.hp || 0) >= requiredHp)
    .map(c => ({ ...c }))  // 深拷贝
  
  if (validYokai.length === 0) {
    spellExchangeState.type = ''
    spellExchangeState.step = 0
    return
  }
  
  // 打开弃牌堆妖怪选择弹窗
  cardSelectModal.title = type === 'medium' ? '🔄 兑换中级符咒' : '🔄 兑换高级符咒'
  cardSelectModal.hint = `选择1张生命≥${requiredHp}的妖怪超度`
  cardSelectModal.candidates = validYokai
  cardSelectModal.count = 1
  cardSelectModal.selected = []
  cardSelectModal.resolve = null  // 清除旧的resolve
  cardSelectModal.onConfirm = executeSpellExchange  // 直接引用函数，不要包装
  cardSelectModal.show = true
}

function executeSpellExchange() {
  const selectedYokaiId = cardSelectModal.selected[0]
  
  if (!selectedYokaiId) {
    resetSpellExchangeState()
    return
  }
  
  const type = spellExchangeState.type
  
  // 多人模式
  if (isMultiMode.value) {
    if (type === 'medium') {
      socketClient.sendAction({ type: 'exchangeMediumSpell', yokaiId: selectedYokaiId })
    } else if (type === 'advanced') {
      socketClient.sendAction({ type: 'exchangeAdvancedSpell', yokaiId: selectedYokaiId })
    }
    resetSpellExchangeState()
    return
  }
  
  // 单人模式
  if (!game) {
    resetSpellExchangeState()
    return
  }
  
  // 调用游戏引擎的兑换方法
  if (type === 'medium') {
    game.exchangeMediumSpell(selectedYokaiId)
  } else if (type === 'advanced') {
    game.exchangeAdvancedSpell(selectedYokaiId)
  }
  
  resetSpellExchangeState()
}

function resetSpellExchangeState() {
  spellExchangeState.type = ''
  spellExchangeState.step = 0
  cardSelectModal.show = false
  cardSelectModal.hint = ''
  cardSelectModal.onConfirm = null
  cardSelectModal.candidates = []
  cardSelectModal.selected = []
}

function cancelCardSelect() {
  // 取消卡牌选择，重置所有状态
  resetSpellExchangeState()
}

function closeSpellModal() {
  spellSelectModal.show = false
}

function handleShikigamiAction() {
  const shikigamiCount = player.value?.shikigami?.length || 0
  const isReplace = shikigamiCount >= 3
  
  if (isReplace) {
    // 置换式神
    if (canReplaceShikigami.value) {
      shikigamiModal.isReplace = true
      openShikigamiModal()
    } else {
      // 检查具体不满足哪个条件
      const reasons: string[] = []
      const shikiCount = player.value?.shikigami?.length || 0
      const phase = state.value?.turnPhase
      const supplyLen = state.value?.field?.shikigamiSupply?.length || 0
      const hasAdvanced = game?.hasAdvancedSpellInHand() ?? false
      
      if (phase !== 'action') {
        reasons.push(`• 需要在行动阶段`)
      }
      if (shikiCount !== 3) {
        reasons.push(`• 需要正好3个式神（当前：${shikiCount}个）`)
      }
      if (!hasAdvanced) {
        reasons.push('• 需要1张高级符咒（3点伤害）')
      }
      if (supplyLen === 0) {
        reasons.push('• 式神商店已空')
      }
      showHint('⚠️ 无法置换式神', reasons.length ? reasons : ['条件不满足'])
    }
  } else {
    // 获得式神
    if (canAcquireShikigami.value) {
      shikigamiModal.isReplace = false
      openShikigamiModal()
    } else {
      showHint('⚠️ 无法获得式神', [
        '条件：',
        '• 弃置≥5点伤害的符咒牌',
        '• 其中需包含至少1张高级符咒'
      ])
    }
  }
}

function endTurn() {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'endTurn' })
  } else {
    game?.endTurn()
  }
}

function refresh(b: boolean) {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'decideYokaiRefresh', refresh: b })
  } else {
    game?.decideYokaiRefresh(b)
  }
}

function confirmShiki() {
  if (!isMyTurn.value) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'confirmShikigamiPhase' })
  } else {
    game?.confirmShikigamiPhase()
  }
}
function cardType(c: CardInstance) { 
  return { 
    spell: c.cardType === 'spell', 
    yokai: c.cardType === 'yokai',
    token: c.cardType === 'token',
    penalty: c.cardType === 'penalty',
    boss: c.cardType === 'boss'
  } 
}

// 检查卡牌是否可以打出
function canPlay(c: CardInstance): boolean {
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value) return false
    if (state.value?.turnPhase !== 'action') return false
    const p = player.value
    if (!p) return false
    // 检查鬼火是否足够
    const cost = c.cost || 0
    if (p.ghostFire < cost) return false
    return true
  }
  // 单人模式
  if (!game) return false
  return game.canPlayCard(c).canPlay
}

// ========== 式神获取/置换相关函数 ==========

function openShikigamiModal() {
  const isReplace = canReplaceShikigami.value
  shikigamiModal.show = true
  shikigamiModal.isReplace = isReplace
  shikigamiModal.step = 1
  shikigamiModal.selectedSpells = []
  shikigamiModal.selectedDamage = 0
  shikigamiModal.oldShikigamiId = ''
  shikigamiModal.candidates = []
  shikigamiModal.selectingOld = false
  shikigamiModal.selectedNewId = ''
}

function closeShikigamiModal() {
  shikigamiModal.show = false
  shikigamiModal.selectingOld = false
  shikigamiModal.selectedNewId = ''
}

function toggleSpellForShikigami(card: CardInstance) {
  const idx = shikigamiModal.selectedSpells.indexOf(card.instanceId)
  if (idx >= 0) {
    shikigamiModal.selectedSpells.splice(idx, 1)
    shikigamiModal.selectedDamage -= (card.damage || card.hp || 1)
  } else {
    shikigamiModal.selectedSpells.push(card.instanceId)
    shikigamiModal.selectedDamage += (card.damage || card.hp || 1)
  }
}

async function nextShikigamiStep() {
  // 多人模式：从服务器获取候选式神
  if (isMultiMode.value) {
    // 发送请求获取候选式神
    socketClient.sendAction({
      type: 'getShikigamiCandidates',
      spellIds: shikigamiModal.selectedSpells,
      isReplace: shikigamiModal.isReplace
    })
    // 服务器会返回候选列表，监听响应
    const response = await new Promise<any>((resolve) => {
      const handler = (data: any) => {
        console.log('[nextShikigamiStep] 收到gameEvent:', data)
        if (data.type === 'shikigamiCandidates') {
          socketClient.off('gameEvent', handler)
          resolve(data)
        }
      }
      socketClient.on('gameEvent', handler)
      // 超时处理
      setTimeout(() => {
        socketClient.off('gameEvent', handler)
        console.log('[nextShikigamiStep] 超时，未收到候选')
        resolve({ candidates: [] })
      }, 5000)
    })
    if (response.candidates && response.candidates.length > 0) {
      shikigamiModal.candidates = response.candidates
      shikigamiModal.step = 2
      shikigamiModal.selectedNewId = ''
    }
    return
  }
  
  // 单人模式
  if (shikigamiModal.isReplace) {
    // 置换模式：先抽取候选式神，然后进入步骤2选新式神
    const candidates = await game?.prepareReplaceShikigami(shikigamiModal.selectedSpells)
    if (candidates && candidates.length > 0) {
      shikigamiModal.candidates = candidates
      shikigamiModal.step = 2  // 进入选新式神步骤
      shikigamiModal.selectedNewId = ''
    } else {
      // 调试：为什么返回null
      console.error('prepareReplaceShikigami failed', shikigamiModal.selectedSpells)
    }
  } else {
    // 获取模式：先消耗符咒，然后进入步骤2选式神
    const candidates = await game?.prepareAcquireShikigami(shikigamiModal.selectedSpells)
    if (candidates && candidates.length > 0) {
      shikigamiModal.candidates = candidates
      shikigamiModal.step = 2  // 进入式神选择步骤
      shikigamiModal.selectedNewId = ''
    }
  }
}

async function selectNewShikigami(shikigami: any) {
  // 选中式神（不再直接确认）
  shikigamiModal.selectedNewId = shikigami.id
}

function confirmNewShikigami() {
  if (!shikigamiModal.selectedNewId) return
  
  if (shikigamiModal.isReplace) {
    // 置换模式：进入步骤3选择要替换的旧式神
    shikigamiModal.step = 3
    shikigamiModal.selectedOldId = ''
  } else {
    // 获取模式：直接确认
    if (isMultiMode.value) {
      socketClient.sendAction({
        type: 'acquireShikigami',
        shikigamiId: shikigamiModal.selectedNewId,
        spellIds: shikigamiModal.selectedSpells
      })
      closeShikigamiModal()
    } else {
      const success = game?.confirmAcquireShikigami(shikigamiModal.selectedNewId)
      if (success) {
        closeShikigamiModal()
      }
    }
  }
}

async function confirmReplaceShikigami() {
  if (!shikigamiModal.selectedNewId || !shikigamiModal.selectedOldId) return
  
  if (isMultiMode.value) {
    // 找到旧式神的槽位索引
    const oldSlotIndex = player.value?.shikigami?.findIndex(s => s.id === shikigamiModal.selectedOldId) ?? 0
    socketClient.sendAction({
      type: 'replaceShikigami',
      shikigamiId: shikigamiModal.selectedNewId,
      slotIndex: oldSlotIndex,
      spellIds: shikigamiModal.selectedSpells
    })
    closeShikigamiModal()
  } else {
    // 执行置换：移除旧式神，添加新式神
    const success = await game?.executeReplaceShikigami(
      shikigamiModal.selectedOldId,
      shikigamiModal.selectedNewId,
      shikigamiModal.candidates
    )
    
    if (success) {
      closeShikigamiModal()
    }
  }
}
</script>

<style scoped>
*{box-sizing:border-box}
.game-container{min-height:100vh;background:#1a1a2e;color:#fff;font-family:'Microsoft YaHei',sans-serif}

/* 大厅 */
.lobby{display:flex;justify-content:center;align-items:center;min-height:100vh}
.lobby-card{background:rgba(255,255,255,.1);padding:40px;border-radius:16px;text-align:center}
.lobby-card h1{font-size:32px;margin-bottom:10px}
.lobby-card h2{color:#888;margin-bottom:20px}
.name-input{width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:15px}
.btn{padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-size:16px}
.btn.primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
.btn:disabled{opacity:.5;cursor:not-allowed}
.tips{margin-top:20px;color:#666;font-size:13px}

/* ══════════════════════════════════════════════
   式神选取阶段
══════════════════════════════════════════════ */
.shikigami-select-phase {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1f47 100%);
}

.select-modal {
  background: rgba(30, 30, 50, 0.95);
  border: 2px solid #667eea;
  border-radius: 16px;
  padding: 30px 40px;
  max-width: 1100px;
  width: 95%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.select-modal h2 {
  text-align: center;
  font-size: 28px;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.select-hint {
  text-align: center;
  color: #aaa;
  margin-bottom: 15px;
}

/* 多人模式倒计时条 */
.countdown-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 20px;
  margin-bottom: 20px;
  background: rgba(255, 100, 100, 0.15);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.countdown-icon {
  font-size: 20px;
  z-index: 1;
}

.countdown-text {
  font-size: 18px;
  font-weight: bold;
  color: #ff6b6b;
  z-index: 1;
}

.countdown-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 100, 100, 0.3), rgba(255, 150, 100, 0.2));
  transition: width 1s linear;
}

.shikigami-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 25px;
}

.shikigami-option {
  background: rgba(40, 40, 70, 0.9);
  border: 3px solid #333;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.shikigami-option:hover {
  border-color: #667eea;
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.shikigami-option.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.4);
  transform: translateY(-3px);
}

/* 式神卡片内部容器 */
.shikigami-card-inner {
  position: relative;
  width: 100%;
}

/* 式神图片 - 完整显示，匹配资源原始比例 */
.shikigami-art {
  width: 100%;
  aspect-ratio: 3 / 4;  /* 竖版比例，匹配角色资源 */
  object-fit: cover;
  object-position: center top;
  display: block;
}

/* 底部透明遮罩层 - 叠加在图片上 */
.shikigami-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 30px 8px 12px;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%);
}

.shikigami-name {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.shikigami-rarity {
  font-size: 13px;
  font-weight: bold;
  padding: 2px 12px;
  border-radius: 10px;
  display: inline-block;
}

.shikigami-rarity.rarity-ssr {
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #1a1a2e;
}

.shikigami-rarity.rarity-sr {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
}

.shikigami-rarity.rarity-r {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
}

/* 选中徽章 */
.select-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #1a1a2e;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
}

/* 已选预览 */
.selected-preview {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 15px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 50px;
}

.preview-label {
  color: #888;
  font-size: 15px;
}

.selected-tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
}

.remove-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.2s;
}

.remove-btn:hover {
  background: rgba(255, 100, 100, 0.6);
}

.empty-hint {
  color: #666;
  font-style: italic;
}

/* 确认按钮 */
.confirm-btn {
  display: block;
  width: 100%;
  padding: 16px;
  background: #444;
  border: none;
  border-radius: 12px;
  color: #888;
  font-size: 18px;
  cursor: not-allowed;
  transition: all 0.3s;
}

.confirm-btn.ready {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  cursor: pointer;
  font-weight: bold;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
}

.confirm-btn.ready:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(34, 197, 94, 0.5);
}

.confirm-btn:disabled {
  opacity: 0.7;
}

.confirm-btn.waiting {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  cursor: wait;
  font-weight: bold;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 响应式：小屏幕时2列 */
@media (max-width: 900px) {
  .shikigami-options {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ══════════════════════════════════════════════
   游戏主布局 - 基于1920x1080设计稿
   使用min(宽度比例, 高度比例)确保完全适配视口
══════════════════════════════════════════════ */
.game-board{
  /* 取宽高中较小的缩放比例，确保内容不超出视口 */
  --sw: calc(100vw / 1920);  /* 基于宽度的缩放 */
  --sh: calc(100vh / 1080);  /* 基于高度的缩放 */
  --s: min(var(--sw), var(--sh));  /* 取较小值 */
  
  position:relative;
  width:calc(var(--s) * 1920);
  height:calc(var(--s) * 1080);
  background:#1A1A2E;
  font-family:'Segoe UI',sans-serif;
  overflow:hidden;
  touch-action:pan-x pan-y;
  user-select:none;
  
  /* 居中显示 */
  margin:0 auto;
}
/* 禁止滚轮缩放 */
.game-board *{
  touch-action:manipulation;
}

/* ══════════════════════════════════════════════
   顶部区域 - Figma精确坐标 (top: 0, height: 150px)
══════════════════════════════════════════════ */
.top-row{
  position:absolute;
  left:0;
  top:0;
  width:100%;
  height:calc(var(--s) * 150);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  padding:0 calc(var(--s) * 20);
}

.info-panel{
  display:none; /* 暂时隐藏，后续移到右侧信息区 */
}
.panel-title{
  font-size:calc(var(--s) * 24);
  color:#FFD700;
  letter-spacing:.05em;
  margin-bottom:calc(var(--s) * 8);
  font-weight:600;
  text-align:center;
}
.log-area{flex:1;overflow-y:auto;font-size:9px;line-height:1.5}
.log-line{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);color:#bbb}

/* 回合数显示 */
.turn-display{
  position:absolute;
  left:calc(var(--s) * 22);
  top:50%;
  transform:translateY(-50%);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  font-weight:bold;
}

/* 玩家信息槽 - 6个玩家位 */
.player-panel{
  position:absolute;
  left:calc(var(--s) * 180);
  top:calc(var(--s) * 15);
  display:flex;
  gap:calc(var(--s) * 25);
}
.player-info-slot{
  display:flex;
  gap:calc(var(--s) * 5);
  position:relative;
  padding:calc(var(--s) * 5);
  border-radius:calc(var(--s) * 4);
  transition:all .3s ease;
}
.player-info-slot.is-current{
  background:rgba(255,215,0,.15);
  box-shadow:0 0 calc(var(--s) * 15) rgba(255,215,0,.4);
}
.player-info-slot.empty-slot{
  opacity:0.3;
}
/* 自己标签 - 类似推荐按钮样式 */
.me-badge{
  position:absolute;
  top:calc(var(--s) * -5);
  right:calc(var(--s) * -5);
  background:linear-gradient(135deg,#4a9eff,#2d7cd6);
  color:#fff;
  font-size:calc(var(--s) * 12);
  padding:calc(var(--s) * 2) calc(var(--s) * 6);
  border-radius:calc(var(--s) * 3);
  font-weight:bold;
  z-index:10;
  box-shadow:0 2px 6px rgba(74,158,255,.4);
}
.player-avatar{
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 120);
  background:#1a1a2e;
  border:2px solid #D4A574;
  display:flex;align-items:center;justify-content:center;
  font-size:calc(var(--s) * 32);
  color:#fff;
  position:relative;
}
.player-avatar.empty{
  background:#151525;
  border-color:#333;
}
.player-avatar.active{
  border:3px solid #FFD700;
  box-shadow:0 0 calc(var(--s) * 15) rgba(255,215,0,.6);
  animation:pulse-turn 1.5s infinite;
}
@keyframes pulse-turn{
  0%,100%{box-shadow:0 0 calc(var(--s) * 15) rgba(255,215,0,.6);}
  50%{box-shadow:0 0 calc(var(--s) * 25) rgba(255,215,0,.9);}
}
.mini-stat.empty-stat{
  background:#151525;
  border-color:#333;
}
.player-stats{
  display:flex;flex-direction:column;gap:0;
}
.mini-stat{
  width:calc(var(--s) * 85);
  height:calc(var(--s) * 60);
  background:#151525;
  border:1px solid #D4A574;
  display:flex;align-items:center;justify-content:center;gap:calc(var(--s) * 5);
  font-size:calc(var(--s) * 24);
  color:#fff;
}
.mini-stat span{font-size:calc(var(--s) * 22)}

/* 手牌图标 - 粉色叠牌样式 */
.icon-hand-cards{
  position:relative;
  width:calc(var(--s) * 20);
  height:calc(var(--s) * 26);
}
.icon-hand-cards::before,
.icon-hand-cards::after{
  content:'';
  position:absolute;
  width:calc(var(--s) * 16);
  height:calc(var(--s) * 22);
  border-radius:2px;
  border:1px solid rgba(255,255,255,.5);
}
.icon-hand-cards::before{
  background:linear-gradient(135deg,#e06090,#c04070);
  top:0;left:0;
}
.icon-hand-cards::after{
  background:linear-gradient(135deg,#ff80b0,#e06090);
  top:calc(var(--s) * 4);
  left:calc(var(--s) * 4);
}

/* LOGO面板 - 右侧 "百鬼夜行" */
.logo-panel{
  position:absolute;
  right:calc(var(--s) * 20);
  top:calc(var(--s) * 17);
  text-align:center;
}
.logo{
  font-size:calc(var(--s) * 64);
  font-weight:bold;
  color:#fff;
  font-family:'Angkor',serif;
  letter-spacing:calc(var(--s) * 4);
}
.stats{
  margin-top:calc(var(--s) * 10);
  display:flex;flex-wrap:wrap;
  gap:calc(var(--s) * 8);
  justify-content:center;
  font-size:calc(var(--s) * 14);
}
.stats span{
  background:#151525;
  padding:calc(var(--s) * 4) calc(var(--s) * 8);
  border-radius:calc(var(--s) * 4);
  border:1px solid #D4A574;
}
.buffs{margin-top:calc(var(--s) * 6);display:flex;flex-wrap:wrap;gap:calc(var(--s) * 4);justify-content:center}
.buff-tag{
  background:linear-gradient(135deg,#ff9800,#e65100);
  padding:calc(var(--s) * 4) calc(var(--s) * 8);
  border-radius:calc(var(--s) * 4);
  font-size:calc(var(--s) * 12);
}

/* ══════════════════════════════════════════════
   中部区域 - Figma精确坐标 (top: 150px, height: 650px)
══════════════════════════════════════════════ */
.mid-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 150);
  width:100%;
  height:calc(var(--s) * 650);
  box-sizing:border-box;
  /* 不需要整体边框，各子区域有自己的边框 */
}

/* 鬼王区 - left:0, width:600px, height:490px */
.boss-panel{
  position:absolute;
  left:0;
  top:0;
  width:calc(var(--s) * 600);
  height:calc(var(--s) * 490);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;
  padding:calc(var(--s) * 20);
}
.boss-card{
  background:linear-gradient(160deg,#3a0a0a,#1a0520);
  border:2px solid #D4A574;
  border-radius:calc(var(--s) * 8);
  text-align:center;cursor:pointer;
  width:calc(var(--s) * 540);
  height:calc(var(--s) * 380);
  position:relative;overflow:hidden;
  transition:all .2s;
  box-shadow:0 calc(var(--s) * 4) calc(var(--s) * 16) rgba(180,0,50,.3);
  display:flex;flex-direction:column;justify-content:flex-end;
}
.boss-card:hover{
  transform:scale(1.03);
  box-shadow:0 6px 24px rgba(220,50,80,.5);
  border-color:rgba(220,50,80,.8);
}
/* 可攻击状态 */
.boss-card.boss-attackable{
  border-color:rgba(255,80,80,.9);
  box-shadow:0 0 20px rgba(255,50,50,.7);
  animation:bossAttackPulse 1s infinite;
  cursor:pointer;
}
/* 妖怪全清提示状态 */
.boss-card.boss-hint{
  border-color:rgba(255,200,50,.6);
  box-shadow:0 0 12px rgba(255,200,50,.4);
}
/* 已击败等待选择 */
.boss-card.boss-defeated{
  border-color:rgba(150,150,150,.5);
  filter:grayscale(.4);
  cursor:default;
}
@keyframes bossAttackPulse{
  0%,100%{box-shadow:0 0 12px rgba(255,50,50,.5)}
  50%{box-shadow:0 0 28px rgba(255,50,50,.9)}
}
/* 已击败覆盖层 */
.boss-defeated-overlay{
  position:absolute;inset:0;z-index:2;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:rgba(0,0,0,.65);
  font-size:11px;color:#aaa;
  border-radius:inherit;pointer-events:none;
}
/* 伤害不足时的提示 */
.boss-no-dmg-hint{
  margin-top:6px;
  font-size:9px;color:#ffcc66;
  text-align:center;
  line-height:1.4;
  background:rgba(0,0,0,.3);
  border-radius:4px;padding:3px 6px;
}
/* 鬼王信息（底部渐变，贴边显示） */
.boss-card .boss-info{
  position:absolute !important;
  left:0;right:0;bottom:0;
  z-index:2;
  background:linear-gradient(0deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 40%,rgba(0,0,0,.2) 80%,transparent 100%);
  padding:25px 0 10px;
  text-align:center;
}
.boss-name{
  font-size:14px;
  font-weight:700;
  color:#f0e6d3;
  text-shadow:0 1px 4px rgba(0,0,0,.8);
}
.boss-stat{
  font-size:13px;
  color:#ccc;
  margin-top:4px;
  display:flex;
  gap:12px;
  justify-content:center;
}
/* 鬼王区底部提示 */
.boss-tip-first{
  color:#aaa;
  padding:8px 12px;
  font-size:11px;
  text-align:center;
  line-height:1.4;
}
.boss-tip-incoming{
  background:linear-gradient(90deg,transparent,rgba(180,30,30,.6),transparent);
  color:#ff6b6b;
  padding:10px 12px;
  font-size:13px;
  font-weight:bold;
  text-align:center;
  animation:bossIncoming 1.5s infinite;
}
@keyframes bossIncoming{
  0%,100%{opacity:0.7}
  50%{opacity:1}
}
.boss-remain{
  color:#777;font-size:9px;
  background:rgba(0,0,0,.3);
  padding:2px 8px;border-radius:10px;
  border:1px solid rgba(255,255,255,.08);
}

/* 游荡妖怪区 - left:600px, width:750px */
.yokai-panel{
  position:absolute;
  left:calc(var(--s) * 600);
  top:0;
  width:calc(var(--s) * 750);
  height:calc(var(--s) * 650);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 15);
  overflow:hidden;
}

/* 游荡妖怪标签 */
.yokai-label{
  position:absolute;
  right:calc(var(--s) * -50);
  top:50%;
  transform:translateY(-50%);
  writing-mode:vertical-rl;
  font-size:calc(var(--s) * 36);
  color:#FFD700;
  letter-spacing:calc(var(--s) * 8);
}

/* 右侧信息区 - left:1350px, width:570px, height:650px (填满中部区域) */
.info-side-panel{
  position:absolute;
  left:calc(var(--s) * 1350);
  top:0;
  width:calc(var(--s) * 570);
  height:calc(var(--s) * 650);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  overflow:hidden;
}
.info-box{
  flex:1;
  background:#1A1A2E;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 10);
  overflow-y:auto;
  overflow-x:hidden;
  display:flex;flex-direction:column;gap:calc(var(--s) * 6);
}
.info-line{
  background:#2D1F3D;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 8) calc(var(--s) * 12);
  font-size:calc(var(--s) * 20);
  color:#fff;
  min-height:calc(var(--s) * 48);
  display:flex;align-items:center;
  word-break:break-all;
  line-height:1.4;
  flex-shrink:0;
}
/* 日志超链接样式 */
.log-link{
  color:#4FC3F7;
  cursor:pointer;
  text-decoration:none;
  transition:all 0.15s;
}
.log-link:hover{
  color:#FFD700;
  text-decoration:underline;
}
/* 日志引用弹出框 */
.log-ref-overlay{
  position:fixed;
  top:0;left:0;right:0;bottom:0;
  z-index:9998;
}
.log-ref-popup{
  position:fixed;
  z-index:9999;
  background:linear-gradient(135deg, #2D1F3D 0%, #1A1A2E 100%);
  border:2px solid #D4A574;
  border-radius:8px;
  padding:12px;
  min-width:180px;
  max-width:280px;
  box-shadow:0 4px 20px rgba(0,0,0,0.5);
}
.log-ref-close{
  position:absolute;
  top:4px;right:8px;
  color:#888;
  cursor:pointer;
  font-size:18px;
  line-height:1;
}
.log-ref-close:hover{color:#fff}
.log-ref-card{
  display:flex;gap:10px;align-items:flex-start;
}
.ref-card-img{
  width:60px;height:84px;
  object-fit:cover;
  border-radius:4px;
  border:1px solid #D4A574;
}
.ref-card-info{display:flex;flex-direction:column;gap:4px}
.ref-card-name{font-size:14px;font-weight:bold;color:#FFD700}
.ref-card-type{font-size:11px;color:#aaa}
.ref-card-stats{font-size:12px;color:#fff}
.log-ref-shikigami,.log-ref-boss,.log-ref-player,.log-ref-default{
  padding:4px 0;
}
.ref-shikigami-name,.ref-boss-name,.ref-player-name{
  font-size:14px;font-weight:bold;color:#FFD700;margin-bottom:4px;
}
.ref-shikigami-skill{font-size:12px;color:#4FC3F7}
.ref-boss-hp{font-size:12px;color:#fff}
.action-buttons{
  display:flex;
  gap:calc(var(--s) * 20);
  padding:calc(var(--s) * 15) 0;
  justify-content:center;
  margin-top:auto;
}
.side-btn{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 100);
  background:#1A1A2E;
  border:2px solid #D4A574;
  color:#fff;
  font-size:calc(var(--s) * 22);
  cursor:pointer;
  transition:all .2s;
  border-radius:calc(var(--s) * 4);
  position:relative;
}
.side-btn:hover:not(.disabled){background:#2D1F3D}
.recommend-badge{
  position:absolute;
  top:-8px;
  right:-8px;
  background:linear-gradient(135deg,#ff6b6b,#ee5a24);
  color:#fff;
  font-size:11px;
  padding:2px 6px;
  border-radius:8px;
  font-weight:bold;
  box-shadow:0 2px 6px rgba(238,90,36,.5);
  animation:pulse-badge 1.5s infinite;
}
@keyframes pulse-badge{
  0%,100%{transform:scale(1)}
  50%{transform:scale(1.1)}
}
.side-btn.disabled{opacity:.5;cursor:pointer;border-color:#666}
.side-btn.disabled:hover{background:#2a2a3e}

/* ══════════════════════════════════════════════
   个人信息区 - top:640px, height:160px
══════════════════════════════════════════════ */
.personal-info-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 640);
  width:calc(var(--s) * 600);
  height:calc(var(--s) * 160);
  display:flex;
}
.self-info{
  width:calc(var(--s) * 245);
  height:100%;
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  padding:calc(var(--s) * 10);
  gap:calc(var(--s) * 10);
}
.avatar-box{
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 120);
  border:1px solid #D4A574;
  background:#1A1A2E;
}
.stat-box{
  flex:1;
  display:flex;flex-direction:column;gap:calc(var(--s) * 5);
}
.stat-item{
  background:#151525;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 8);
  display:flex;align-items:center;gap:calc(var(--s) * 8);
  font-size:calc(var(--s) * 20);
}
.stat-item span{font-size:calc(var(--s) * 24)}
.stat-item b{color:#fff}

.deck-discard-area{
  width:calc(var(--s) * 360);
  height:100%;
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  gap:calc(var(--s) * 20);
  padding:calc(var(--s) * 18);
  justify-content:center;
}
.pile-box{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 120);
  background:#1A1A2E;
  border:2px solid #D4A574;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.pile-box b{font-size:calc(var(--s) * 40);color:#fff}
.pile-box span{font-size:calc(var(--s) * 24);color:#aaa}

/* 3列x2行 妖怪网格 */
.yokai-grid{
  display:grid;
  grid-template-columns:repeat(3, calc(var(--s) * 180));
  grid-template-rows:repeat(2, calc(var(--s) * 250));
  gap:calc(var(--s) * 15);
  justify-content:center;
  align-content:center;
  flex:1;
}
.yokai-card{
  width:calc(var(--s) * 180);
  height:calc(var(--s) * 250);
  background:#1A1A2E;
  border:1px solid #D4A574;
  border-radius:calc(var(--s) * 4);
  cursor:pointer;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  transition:all .18s;
  box-sizing:border-box;
}
.yokai-card:hover:not(.empty){
  border-color:rgba(120,160,255,.6);
  box-shadow:0 4px 16px rgba(80,120,255,.3);
  transform:translateY(-2px);
}
.yokai-card.empty{
  background:rgba(30,50,90,.15);
  border-color:rgba(80,120,200,.08);
  cursor:default;
}
.yokai-card.wounded{border-color:#ff6b6b;box-shadow:0 0 8px rgba(255,80,80,.3)}
.yokai-card.canKill{border-color:#4CAF50;box-shadow:0 0 12px rgba(76,175,80,.7);animation:canKillPulse 1.2s infinite}
.yokai-card.killed{border-color:#e91e63;box-shadow:0 0 10px rgba(233,30,99,.5)}
.yokai-card.selecting{border-color:#ff9800;animation:pulse 1s infinite}

/* 妖怪卡片底部信息条 */
.yokai-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,.4) 70%,transparent 100%);
  padding:calc(var(--s) * 18) calc(var(--s) * 8) calc(var(--s) * 8);
}
.y-name{
  font-size:calc(var(--s) * 16);
  font-weight:700;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:#f0e6d3;text-shadow:0 1px 4px rgba(0,0,0,.8);
  text-align:center;
}
.y-stat{
  font-size:calc(var(--s) * 14);
  color:#ccc;
  margin-top:calc(var(--s) * 4);
  display:flex;gap:calc(var(--s) * 8);justify-content:center;
}
.hp-damaged{color:#ff6b6b;font-weight:bold}
.killed-badge{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  background:rgba(0,0,0,.9);
  padding:calc(var(--s) * 8) calc(var(--s) * 16);
  border-radius:calc(var(--s) * 6);
  font-size:calc(var(--s) * 16);
  color:#e91e63;
  white-space:nowrap;font-weight:bold;
  border:1px solid rgba(233,30,99,.5);
  z-index:2;
}
@keyframes canKillPulse{
  0%,100%{box-shadow:0 0 6px rgba(76,175,80,.4)}
  50%{box-shadow:0 0 16px rgba(76,175,80,.9)}
}

.action-bar{
  display:flex;gap:5px;align-items:center;
  padding-top:5px;
  border-top:1px solid rgba(255,255,255,.08);
  margin-top:auto;flex-shrink:0;
}
.deck-num,.exile-num{
  background:rgba(0,0,0,.4);
  border:1px solid rgba(255,255,255,.1);
  padding:4px 8px;border-radius:4px;font-size:10px;
  color:#aaa;min-width:28px;text-align:center;
}
.act-btn{
  flex:1;padding:5px;
  background:rgba(80,120,200,.2);
  border:1px solid rgba(80,120,200,.4);
  border-radius:5px;color:#b0c4de;
  cursor:pointer;font-size:10px;
  transition:all .15s;
}
.act-btn:hover:not(:disabled){
  background:rgba(80,120,200,.4);
  color:#fff;border-color:rgba(100,160,255,.6);
}
.act-btn:disabled{opacity:.35;cursor:not-allowed}

/* ══════════════════════════════════════════════
   底部区域 - Figma精确坐标 (top: 800px)
══════════════════════════════════════════════ */
.bot-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 800);
  width:100%;
  height:calc(var(--s) * 280);
  display:flex;
  z-index:10;
}

/* 式神区 - left:0, width:450px */
.shiki-panel{
  position:absolute;
  left:0;
  top:0;
  width:calc(var(--s) * 450);
  height:calc(var(--s) * 280);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  align-items:center;
}
.shiki-label{
  position:absolute;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  pointer-events:none;
  opacity:.3;
}
.shiki-cards{
  display:flex;
  gap:calc(var(--s) * 10);
  padding:calc(var(--s) * 10);
}
.ghost-fire-bar{
  display:flex;
  gap:calc(var(--s) * 5);
  margin-top:auto;
  padding-bottom:calc(var(--s) * 10);
}
.fire-slot{
  width:calc(var(--s) * 40);
  height:calc(var(--s) * 40);
  background:#333;
  border-radius:50%;
  border:1px solid #D4A574;
}
.fire-slot.active{
  background:linear-gradient(135deg,#ff6b35,#f7931e);
  box-shadow:0 0 calc(var(--s) * 10) rgba(255,107,53,.6);
}
.shiki-card{
  width:calc(var(--s) * 135);
  height:calc(var(--s) * 192);
  background:#1A1A2E;
  border:1px solid #D4A574;
  border-radius:calc(var(--s) * 4);
  cursor:pointer;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  transition:all .18s;
}
.shiki-card:hover:not(.tired){
  border-color:#FFD700;
  box-shadow:0 0 calc(var(--s) * 12) rgba(255,215,0,.4);
  transform:translateY(calc(var(--s) * -4));
}
.shiki-card.tired{opacity:.35;filter:grayscale(.8)}

/* 式神卡底部信息（渐变透明，贴边显示） */
.shiki-card .shiki-info{
  position:absolute !important;
  left:0;right:0;bottom:0;
  z-index:2;
  background:linear-gradient(0deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 40%,rgba(0,0,0,.2) 80%,transparent 100%);
  padding:calc(var(--s) * 18) 0 calc(var(--s) * 5);
}
.shiki-row1{
  display:flex;
  justify-content:center;
  align-items:center;
  gap:calc(var(--s) * 6);
}
.shiki-name{
  font-size:calc(var(--s) * 14);
  font-weight:700;
  color:#f0e6d3;
  text-shadow:0 1px 4px rgba(0,0,0,.8);
}
.shiki-rarity-tag{
  font-size:calc(var(--s) * 10);
  padding:calc(var(--s) * 1) calc(var(--s) * 5);
  border-radius:calc(var(--s) * 3);
  font-weight:bold;
}
.shiki-rarity-tag.rarity-ssr{background:linear-gradient(135deg,#FFD700,#FFA500);color:#3a2a00}
.shiki-rarity-tag.rarity-sr{background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff}
.shiki-rarity-tag.rarity-r{background:linear-gradient(135deg,#3498db,#2980b9);color:#fff}
.shiki-row2{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:calc(var(--s) * 6);
  margin-top:calc(var(--s) * 4);
}
.shiki-skill-label{
  font-size:calc(var(--s) * 10);
  color:#c8b896;
}

/* 牌库面板 - 移入式神区内部 */
.pile-panel{
  position:absolute;
  right:calc(var(--s) * 10);
  bottom:calc(var(--s) * 10);
  display:flex;flex-direction:column;gap:calc(var(--s) * 5);
}
.pile{
  width:calc(var(--s) * 80);
  height:calc(var(--s) * 50);
  background:#151525;
  border:1px solid #D4A574;
  border-radius:4px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
}
.pile span{font-size:calc(var(--s) * 14);color:#aaa}
.pile b{font-size:calc(var(--s) * 20);color:#fff;font-weight:600}

/* 手牌区 - left:450px, width:1175px */
.hand-panel{
  position:absolute;
  left:calc(var(--s) * 450);
  top:0;
  width:calc(var(--s) * 1175);
  height:calc(var(--s) * 280);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  padding:calc(var(--s) * 10);
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.damage-display{
  position:absolute;
  left:calc(var(--s) * 10);
  top:calc(var(--s) * 10);
  width:calc(var(--s) * 100);
  height:calc(var(--s) * 70);
  background:#151525;
  border:1px solid #D4A574;
  display:flex;align-items:center;justify-content:center;gap:calc(var(--s) * 8);
  font-size:calc(var(--s) * 28);
}
.damage-display b{color:#fff;font-size:calc(var(--s) * 32)}
.hand-label{
  position:absolute;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  pointer-events:none;
  opacity:0.3;
}
.hand-cards{
  display:flex;
  gap:0;
  overflow-x:auto;
  flex:1;
  align-items:center;  /* 改为垂直居中 */
  justify-content:center;
  padding:0 calc(var(--s) * 5);
}
.hand-cards::-webkit-scrollbar{height:3px}
.hand-cards::-webkit-scrollbar-track{background:transparent}
.hand-cards::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}

/* 手牌：保持3:4比例，自适应叠加 */
.hand-card{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 200);
  border-radius:calc(var(--s) * 6);
  text-align:center;cursor:pointer;flex-shrink:0;
  transition:all .18s;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  border:1px solid #D4A574;
  box-shadow:0 calc(var(--s) * 2) calc(var(--s) * 8) rgba(0,0,0,.4);
  margin-left:calc(var(--s) * 8);  /* 默认正间距，牌少时展开 */
}
.hand-card:first-child{
  margin-left:0;
}
/* 牌多时自动叠加：6张以上开始负边距 */
.hand-cards:has(.hand-card:nth-child(6)) .hand-card:not(:first-child){
  margin-left:calc(var(--s) * -30);
}
.hand-cards:has(.hand-card:nth-child(8)) .hand-card:not(:first-child){
  margin-left:calc(var(--s) * -50);
}
.hand-cards:has(.hand-card:nth-child(10)) .hand-card:not(:first-child){
  margin-left:calc(var(--s) * -70);
}
.hand-card:hover:not(.unplayable){
  transform:translateY(calc(var(--s) * -25)) scale(1.08);
  box-shadow:0 15px 30px rgba(0,0,0,.7);
  border-color:rgba(255,255,255,.6);
  z-index:10;
}
.hand-card.spell{background:linear-gradient(160deg,#0d2b5e,#1565C0)}
.hand-card.yokai{background:linear-gradient(160deg,#0a2a14,#1b5e20)}
.hand-card.token{background:linear-gradient(160deg,#3e2000,#e65100)}
.hand-card.penalty{background:linear-gradient(160deg,#1a1a2e,#37474f)}
.hand-card.boss{background:linear-gradient(160deg,#2a0030,#6a1b9a)}
.hand-card.unplayable{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
.hand-card.unplayable:hover{transform:none;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.hand-card.selecting{border:2px solid #ff9800;box-shadow:0 0 10px rgba(255,152,0,.5)}

/* 手牌底部信息条 */
.card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:calc(var(--s) * 16) calc(var(--s) * 6) calc(var(--s) * 6);
}
.c-name{
  font-size:calc(var(--s) * 14);
  font-weight:700;
  color:#f0e6d3;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  text-align:center;
}
.c-stat{
  font-size:calc(var(--s) * 14);
  color:#ddd;
  margin-top:calc(var(--s) * 3);
  text-align:center;
}

/* 回合结束区 - left:1625px, width:295px */
.end-panel{
  position:absolute;
  left:calc(var(--s) * 1625);
  top:0;
  width:calc(var(--s) * 295);
  height:calc(var(--s) * 280);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--s) * 10);
}
.end-btn{
  width:calc(var(--s) * 221);
  height:calc(var(--s) * 198);
  background:#539D9D;
  border:2px solid #D4A574;
  border-radius:calc(var(--s) * 8);
  color:#fff;
  font-size:calc(var(--s) * 32);
  cursor:pointer;font-weight:bold;
  transition:all .18s;
}
.end-btn:hover:not(:disabled){
  background:#5DB5B5;
  box-shadow:0 0 calc(var(--s) * 20) rgba(83,157,157,.6);
}
.end-btn:disabled{opacity:.4;cursor:not-allowed}
.phase{font-size:calc(var(--s) * 16);color:#aaa;text-align:center}

/* 弹窗 - 适配1024x768 */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100}
.modal-box{background:#2d2d44;padding:16px;border-radius:8px;text-align:center;min-width:240px;max-width:90vw}
.modal-title{font-size:14px;font-weight:bold;margin-bottom:10px}
.modal-hint{font-size:11px;color:#aaa;margin-bottom:8px}
.modal-actions{margin-top:10px}

/* 操作提示弹窗 */
.hint-modal{min-width:300px;max-width:400px}
.hint-modal .modal-title{font-size:18px;color:#ffd700;margin-bottom:15px}

/* 阴阳术选择弹窗 */
.spell-select-modal{min-width:350px}
.spell-modal-hint{color:#aaa;font-size:13px;margin-bottom:15px;text-align:center}
.spell-type-list{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
.spell-type-card{
  background:linear-gradient(135deg,#1a1a3e,#2a2a5e);
  border:2px solid #4a4a8a;
  border-radius:8px;
  padding:12px 15px;
  cursor:pointer;
  transition:all .2s;
}
.spell-type-card:hover:not(.disabled){
  border-color:#7a7afa;
  background:linear-gradient(135deg,#2a2a5e,#3a3a7e);
  transform:translateX(5px);
}
.spell-type-card.disabled{
  opacity:0.5;
  cursor:not-allowed;
  border-color:#333;
  pointer-events:none;
}
.spell-type-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.spell-type-name{font-size:16px;font-weight:bold;color:#fff}
.spell-type-damage{font-size:14px;color:#ff6b6b}
.spell-type-condition{font-size:12px;color:#888;line-height:1.4}
.cancel-btn{
  width:100%;
  padding:10px;
  background:#444;
  border:none;
  border-radius:6px;
  color:#fff;
  cursor:pointer;
  font-size:14px;
}
.cancel-btn:hover{background:#555}
.hint-content{text-align:left;padding:10px 15px;background:rgba(0,0,0,.3);border-radius:6px;margin-bottom:15px}
.hint-content p{font-size:14px;color:#ddd;margin:6px 0;line-height:1.5}
.confirm-hint-btn{padding:10px 30px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:8px;color:#fff;font-size:14px;cursor:pointer;transition:all .2s}
.confirm-hint-btn:hover{transform:translateY(-2px);box-shadow:0 4px 15px rgba(102,126,234,.5)}

/* 效果选择弹窗 */
.choice-modal{min-width:260px}
.choice-options{display:flex;flex-direction:column;gap:8px}
.choice-btn{padding:10px 14px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;transition:all .15s}
.choice-btn:hover{transform:scale(1.02);box-shadow:0 3px 12px rgba(102,126,234,.4)}

/* 卡牌选择弹窗 */
.card-select-modal{min-width:320px}
.card-select-grid{display:flex;flex-wrap:wrap;gap:15px;justify-content:center;max-height:300px;overflow-y:auto;padding:15px}
.select-card-item{
  width:120px;height:168px;
  border-radius:6px;overflow:hidden;
  position:relative;
  display:flex;flex-direction:column;justify-content:flex-end;
  border:3px solid #555;
  background:linear-gradient(160deg,#1a1a3e,#2a2a5e);
  cursor:pointer;transition:all .15s;
}
.select-card-item .card-art{
  position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;
}
.select-card-item .card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:20px 8px 8px;
}
.select-card-item .c-name{font-size:13px;font-weight:bold;color:#f0e6d3}
.select-card-item .c-stat{font-size:12px;color:#ddd;margin-top:4px}
.select-card-item:hover{transform:translateY(-5px);border-color:#888}
.select-card-item.selected{border-color:#4CAF50;box-shadow:0 0 15px rgba(76,175,80,.5)}
.select-card-item.yokai{border-color:#4a7c59}
.select-card-item.token{border-color:#9c8a4a}
.select-check{
  position:absolute;top:8px;right:8px;
  width:28px;height:28px;
  background:#4CAF50;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:bold;color:#fff;
  z-index:2;
}

/* 目标选择弹窗 */
.target-modal{min-width:280px}
.target-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.target-card{width:70px;padding:10px 6px;background:linear-gradient(135deg,#ff5722,#e64a19);border-radius:5px;text-align:center;cursor:pointer;transition:all .15s}
.target-card:hover{transform:scale(1.03)}
.target-card .c-name{font-size:10px;font-weight:bold}
.target-card .c-stat{font-size:9px;margin-top:2px}

/* 超度区弹窗 */
/* 超度区按钮（类似牌库样式） */
.exile-btn{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 100);
  background:#1A1A2E;
  border:2px solid #D4A574;
  color:#fff;
  cursor:pointer;
  border-radius:calc(var(--s) * 4);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  transition:all .2s;
}
.exile-btn:hover{background:#2D1F3D}
.exile-count{font-size:calc(var(--s) * 32);font-weight:bold}
.exile-label{font-size:calc(var(--s) * 16);color:#aaa}

/* 超度区弹窗 */
.exiled-panel{
  background:linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%);
  border:3px solid #D4A574;
  border-radius:12px;
  padding:25px 30px;
  text-align:center;
  max-width:90vw;
  max-height:80vh;
  overflow-y:auto;
}
.exiled-title{color:#ffd700;font-size:22px;margin-bottom:10px}
.exiled-hint{font-size:13px;color:#888;margin-bottom:20px}
.exiled-card-list{
  display:flex;
  flex-wrap:wrap;
  gap:15px;
  justify-content:center;
  margin-bottom:20px;
}
.exiled-card-item{
  width:120px;
  height:168px;
  border-radius:6px;
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  border:2px solid #666;
  background:linear-gradient(160deg,#1a1a3e,#2a2a5e);
}
.exiled-card-item .card-art{
  position:absolute;
  top:0;left:0;
  width:100%;height:100%;
  object-fit:cover;
}
.exiled-card-item .card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:20px 8px 8px;
}
.exiled-card-item .c-name{font-size:13px;font-weight:bold;color:#f0e6d3}
.exiled-card-item .c-stat{font-size:12px;color:#ddd;margin-top:4px}
.exiled-card-item.yokai{border-color:#4a7c59}
.exiled-card-item.spell{border-color:#4a6c9c}
.exiled-card-item.boss{border-color:#9c4a4a}
.exiled-close-btn{
  padding:10px 40px;
  background:#444;
  border:none;
  border-radius:6px;
  color:#fff;
  cursor:pointer;
  font-size:14px;
}
.exiled-close-btn:hover{background:#555}
.empty-hint{color:#888;margin:20px 0;font-size:14px}

/* 牌库/弃牌堆查看弹窗 */
.pile-box{cursor:pointer;transition:all .2s}
.pile-box:hover{background:#2D1F3D;border-color:#FFD700}
.pile-view-panel{
  background:linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%);
  border:3px solid #D4A574;
  border-radius:12px;
  padding:25px 30px;
  text-align:center;
  max-width:90vw;
  max-height:80vh;
  overflow-y:auto;
}
.pile-view-title{color:#ffd700;font-size:22px;margin-bottom:10px}
.pile-view-hint{font-size:13px;color:#888;margin-bottom:20px}
.pile-card-list{
  display:flex;
  flex-wrap:wrap;
  gap:15px;
  justify-content:center;
  margin-bottom:20px;
}
.pile-card-item{
  width:120px;
  height:168px;
  border-radius:6px;
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  border:2px solid #666;
  background:linear-gradient(160deg,#1a1a3e,#2a2a5e);
}
.pile-card-item .card-art{
  position:absolute;
  top:0;left:0;
  width:100%;height:100%;
  object-fit:cover;
}
.pile-card-item .card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:20px 8px 8px;
}
.pile-card-item .c-name{font-size:13px;font-weight:bold;color:#f0e6d3}
.pile-card-item .c-stat{font-size:12px;color:#ddd;margin-top:4px}
.pile-card-item.spell{border-color:#4a6c9c}
.pile-card-item.token{border-color:#9c8a4a}
.pile-card-item.yokai{border-color:#4a7c59}
.pile-card-item.penalty{border-color:#9c4a4a}
.pile-close-btn{
  padding:10px 40px;
  background:#444;
  border:none;
  border-radius:6px;
  color:#fff;
  cursor:pointer;
  font-size:14px;
}
.pile-close-btn:hover{background:#555}

/* 式神获取/置换弹窗 */
.shikigami-modal{min-width:320px;max-width:400px}
.shikigami-step{padding:8px 0;text-align:center}
.step-hint{font-size:12px;color:#aaa;margin-bottom:8px}
.step-info{font-size:14px;font-weight:bold;color:#4CAF50;margin-bottom:12px}
.spell-select-grid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-height:320px;overflow-y:auto;padding:12px}
/* 选卡界面卡片：与手牌样式一致 */
.spell-select-card{
  width:100px;
  height:140px;
  border-radius:6px;
  cursor:pointer;
  transition:all .15s;
  border:2px solid #D4A574;
  position:relative;
  overflow:hidden;
  display:flex;flex-direction:column;justify-content:flex-end;
  background:linear-gradient(160deg,#0d2b5e,#1565C0);
}
.spell-select-card .card-art{
  position:absolute;
  top:0;left:0;
  width:100%;height:100%;
  object-fit:cover;
}
.spell-select-card .card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:18px 6px 8px;
  text-align:center;
}
.spell-select-card .c-name{font-size:12px;font-weight:bold;color:#f0e6d3}
.spell-select-card .c-stat{font-size:13px;margin-top:3px;color:#ddd}
.spell-select-card:hover{transform:translateY(-5px);box-shadow:0 6px 15px rgba(0,0,0,.5);border-color:rgba(255,255,255,.5)}
.spell-select-card.selected{border-color:#4CAF50;box-shadow:0 0 15px rgba(76,175,80,.6)}

.old-shiki-grid{display:flex;gap:10px;justify-content:center}
.old-shiki-card{width:80px;padding:12px 8px;background:linear-gradient(135deg,#ff9800,#f57c00);border-radius:6px;text-align:center;cursor:pointer;transition:all .15s}
.old-shiki-card:hover{transform:scale(1.05);box-shadow:0 3px 12px rgba(255,152,0,.5)}

.new-shiki-grid{display:flex;gap:10px;justify-content:center}
.new-shiki-card{width:90px;padding:12px 8px;background:linear-gradient(135deg,#9c27b0,#7b1fa2);border-radius:6px;text-align:center;cursor:pointer;transition:all .15s}
.new-shiki-card:hover{transform:scale(1.05);box-shadow:0 3px 12px rgba(156,39,176,.5)}
.new-shiki-card .s-name{font-size:11px;font-weight:bold;margin-bottom:4px}
.new-shiki-card .s-rarity{font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.3)}
.new-shiki-card .s-rarity.rarity-ssr{color:#FFD700}
.new-shiki-card .s-rarity.rarity-sr{color:#C0C0C0}
.new-shiki-card .s-rarity.rarity-r{color:#CD7F32}
.new-shiki-card .s-charm{font-size:10px;margin-top:4px}

/* 获取式神独立界面 */
.acquire-shikigami-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.acquire-shikigami-panel {
  text-align: center;
  padding: 30px 50px;
}

.acquire-title {
  font-size: 28px;
  color: #ffd700;
  margin-bottom: 10px;
}

.acquire-hint {
  font-size: 16px;
  color: #aaa;
  margin-bottom: 30px;
}

.acquire-cards {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 30px;
}
/* 2选1时限制卡片宽度，与4选2保持一致 */
.acquire-cards .shikigami-option {
  width: 200px;
  flex-shrink: 0;
}

.acquire-confirm-btn {
  min-width: 200px;
  padding: 15px 40px;
  font-size: 18px;
  border: none;
  border-radius: 10px;
  cursor: not-allowed;
  background: #444;
  color: #888;
  transition: all 0.3s;
}

.acquire-confirm-btn.ready {
  cursor: pointer;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
}

.acquire-confirm-btn.ready:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(34, 197, 94, 0.5);
}

/* 按钮行 */
.modal-actions-row {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 15px;
}

.modal-actions-row .btn {
  min-width: 120px;
  padding: 12px 24px;
}

/* 居中单按钮 */
.modal-actions-center {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.confirm-acquire-btn {
  min-width: 200px;
  padding: 14px 40px;
  font-size: 16px;
}

/* 式神区按钮 */
.panel-title{display:flex;align-items:center;justify-content:space-between;padding:0 2px}
.shiki-btn{padding:2px 6px;font-size:9px;background:linear-gradient(135deg,#ff9800,#f57c00);border:none;border-radius:3px;color:#fff;cursor:pointer}
.shiki-btn:hover{transform:scale(1.05)}
.shiki-card.selecting{border:2px dashed #ff9800;animation:pulse 1s infinite}

@keyframes pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(255,152,0,.4)}
  50%{box-shadow:0 0 0 8px rgba(255,152,0,0)}
}

/* ── 卡牌图片通用样式 ── */
.card-art{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:top center;
  border-radius:inherit;pointer-events:none;
  z-index:0;
}
.boss-art{object-position:center center}
/* 文字层在图片上方 */
.boss-card > *:not(.card-art),
.yokai-card > *:not(.card-art),
.shiki-card > *:not(.card-art),
.hand-card > *:not(.card-art){position:relative;z-index:1}
</style>

<style>
/* 卡牌悬浮提示 - 全局样式（不使用scoped，因为Teleport到body） */
.card-tooltip{
  position:fixed;
  z-index:9999;
  background:linear-gradient(135deg,#2d2d44 0%,#1a1a2e 100%);
  border:2px solid #D4A574;
  border-radius:12px;
  padding:16px 20px;
  min-width:280px;
  max-width:360px;
  box-shadow:0 8px 32px rgba(0,0,0,.6);
  pointer-events:none;
  animation:tooltipIn .12s ease-out;
  font-family:'Microsoft YaHei',sans-serif;
  color:#fff;
}

@keyframes tooltipIn{
  from{opacity:0;transform:translateY(5px)}
  to{opacity:1;transform:translateY(0)}
}

.tooltip-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:10px;
  padding-bottom:10px;
  border-bottom:1px solid rgba(255,255,255,.2);
}

.tooltip-name{
  font-size:18px;
  font-weight:bold;
}

.tooltip-type{
  font-size:12px;
  padding:4px 10px;
  border-radius:4px;
  background:rgba(100,100,100,.5);
}

.tooltip-type.type-spell{
  background:linear-gradient(135deg,#2196F3,#1976D2);
}

.tooltip-type.type-yokai{
  background:linear-gradient(135deg,#4CAF50,#388E3C);
}

.tooltip-type.type-token{
  background:linear-gradient(135deg,#ff9800,#f57c00);
}

.tooltip-type.type-penalty{
  background:linear-gradient(135deg,#f44336,#d32f2f);
}

.tooltip-type.type-boss{
  background:linear-gradient(135deg,#b71c1c,#880e4f);
}

.tooltip-type.rarity-ssr{
  background:linear-gradient(135deg,#ffd700,#ff8c00);
  color:#000;
}

.tooltip-type.rarity-sr{
  background:linear-gradient(135deg,#9c27b0,#7b1fa2);
}

.tooltip-type.rarity-r{
  background:linear-gradient(135deg,#2196F3,#1976D2);
}

.tooltip-stats{
  display:flex;
  gap:12px;
  margin-bottom:10px;
}

.stat-item{
  font-size:14px;
  background:rgba(255,255,255,.1);
  padding:5px 10px;
  border-radius:4px;
}

.tooltip-subtype{
  font-size:13px;
  color:#aaa;
  margin-bottom:8px;
  font-style:italic;
}

.tooltip-effect{
  font-size:14px;
  line-height:1.5;
  color:#e0e0e0;
  padding:10px;
  background:rgba(0,0,0,.2);
  border-radius:6px;
  border-left:3px solid #667eea;
}
.tooltip-effect p{
  margin:0 0 6px 0;
}
.tooltip-effect p:last-child{
  margin-bottom:0;
}

.tooltip-passive,.tooltip-skill{
  margin-top:10px;
  padding:10px;
  background:rgba(0,0,0,.2);
  border-radius:6px;
}

.tooltip-passive{
  border-left:3px solid #4CAF50;
}

.tooltip-skill{
  border-left:3px solid #ff9800;
}

.passive-label,.skill-label{
  display:block;
  font-size:13px;
  font-weight:bold;
  margin-bottom:5px;
}

.passive-label{color:#4CAF50}
.skill-label{color:#ff9800}

.tooltip-passive p,.tooltip-skill p{
  margin:0;
  font-size:13px;
  color:#ccc;
  line-height:1.4;
}
</style>

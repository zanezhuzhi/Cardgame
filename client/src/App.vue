<template>
  <div class="game-container">
    <!-- 多人模式：等待加载状态 -->
    <div v-if="isMultiMode && !state" class="lobby">
      <div class="lobby-card">
        <h1>🎴 御魂传说</h1>
        <h2>多人对战模式</h2>
        <p class="tips" v-if="socketClient.currentRoom.value">正在同步游戏状态…</p>
        <p class="tips" v-else>正在跳转到大厅（多人需先在大厅连接并加入房间）</p>
        <button @click="returnToLobby" class="btn">返回大厅</button>
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
                 'boss-hint': allYokaiCleared && !isBossDefeated && state?.turnPhase === 'action',
                 zhenmuBlockedMe: isZhenMuBlockedForBoss
               }"
               @click="hitBoss"
               @mouseenter="showBossTooltip($event, boss)"
               @mouseleave="hideTooltip">
            <img v-if="getCardImage(boss)" :src="getCardImage(boss)" class="card-art boss-art" />
            <div
              v-if="isZhenMuShouShieldVisibleForBoss && !isBossDefeated"
              class="zhenmu-shield-badge zhenmu-shield-badge--boss"
              title="镇墓兽：本回合内有玩家不能将该目标击杀/退治"
            >🛡️</div>
            <!-- 鬼王被击败（已自动退治） -->
            <div v-if="isBossDefeated" class="boss-defeated-overlay">💀 已击败</div>
            <!-- 鬼王信息（顶部渐变） -->
            <div class="boss-info">
              <div class="boss-name">{{boss.name}}</div>
              <div class="boss-stat">
                <span class="skill-cost-display field-hp-wrap" :class="{'hp-damaged': displayBossCurrentHp < displayBossMaxHp}">
                  <template v-if="showBossHpNetCutterStrike">
                    <span class="cost-original">❤️{{bossHpRawCurrent}}/{{bossHpRawMax}}</span>
                    <span class="cost-reduced">❤️{{displayBossCurrentHp}}/{{displayBossMaxHp}}</span>
                  </template>
                  <template v-else>
                    ❤️{{displayBossCurrentHp}}/{{displayBossMaxHp}}
                  </template>
                </span>
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
          <div class="yokai-panel-header-row">
            <div class="panel-title yokai-panel-title">👻 游荡妖怪区</div>
            <div v-if="showTurnCountdown" class="turn-countdown-bar" :class="{ 'my-turn': isMyTurn }">
              <span class="countdown-icon">⏱️</span>
              <span class="countdown-text">回合倒计时：{{ turnCountdownDisplay }}</span>
              <div v-if="turnCountdownMax > 0" class="countdown-progress" :style="{ width: (turnCountdown / turnCountdownMax * 100) + '%' }"></div>
              <div v-if="multiplayerWaitingForOffTurnFeedback" class="off-turn-wait-hint">
                等待其他玩家响应…（本回合计时尚未消耗）
              </div>
            </div>
          </div>
          <div class="yokai-grid">
            <div v-for="(y,i) in yokai" :key="i" 
                 class="yokai-card" 
                 :class="{
                   empty: !y, 
                   wounded: y && isWounded(y) && !isKilled(y),
                   canKill: y && canKillYokai(y),
                   killed: y && isKilled(y),
                   selecting: selectingTarget && y,
                   zhenmuBlockedMe: y && isZhenMuBlockedForMe(y.instanceId)
                 }"
                 @click="y && handleYokaiClick(i, y)"
                 @mouseenter="y && showTooltip($event, y)"
                 @mouseleave="hideTooltip">
              <template v-if="y">
                <img v-if="getCardImage(y)" :src="getCardImage(y)" class="card-art yokai-art" />
                <div
                  v-if="isZhenMuShouShieldOnYokai(y)"
                  class="zhenmu-shield-badge"
                  title="镇墓兽：本回合内有玩家不能将该目标击杀/退治"
                >🛡️</div>
                <div class="yokai-info">
                  <div class="y-name">{{y.name}}</div>
                  <div class="y-stat">
                    <span class="skill-cost-display field-hp-wrap" :class="{'hp-damaged': displayYokaiCurrentHp(y) < displayYokaiMaxHp(y)}">
                      <template v-if="yokaiHpShowNetCutterStrike(y)">
                        <span class="cost-original">❤️{{getYokaiCurrentHp(y)}}/{{getYokaiMaxHp(y)}}</span>
                        <span class="cost-reduced">❤️{{displayYokaiCurrentHp(y)}}/{{displayYokaiMaxHp(y)}}</span>
                      </template>
                      <template v-else>
                        ❤️{{displayYokaiCurrentHp(y)}}/{{displayYokaiMaxHp(y)}}
                      </template>
                    </span>
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
          <div class="info-box-wrapper">
            <div class="info-box" ref="logRef" @click="handleLogLinkClick" @scroll="handleLogScroll">
              <div v-for="(l,i) in logs" :key="logEntryRowKey(l, i)" class="info-line" :class="{ 'chat-line': l.type === 'chat' }" v-html="renderLogMessage(l, i)"></div>
            </div>
            <button v-if="hasNewMessage" class="new-message-btn" @click="scrollToBottom">
              有新消息 ↓
            </button>
          </div>
          <!-- 聊天输入栏 -->
          <div class="chat-input-bar">
            <button class="chat-emoji-btn" @click.stop="showEmojiPanel = !showEmojiPanel" title="表情">😀</button>
            <input
              ref="chatInputRef"
              class="chat-input"
              v-model="chatInputText"
              :placeholder="chatInputPlaceholder"
              :disabled="chatCooldownRemaining > 0 && !chatInputText.startsWith('/')"
              maxlength="100"
              @keydown.enter.exact.prevent="handleChatSend"
              @keydown.up.exact.prevent="handleChatHistoryUp"
              @keydown.down.exact.prevent="handleChatHistoryDown"
              @input="handleChatInputChange"
            />
            <button
              class="chat-send-btn"
              :disabled="!chatInputText.trim() || (chatCooldownRemaining > 0 && !chatInputText.startsWith('/'))"
              @click="handleChatSend"
            >发送</button>
            <!-- 表情面板 -->
            <div v-if="showEmojiPanel" class="emoji-panel" @click.stop>
              <span v-for="e in emojiList" :key="e" class="emoji-item" @click="insertEmoji(e)">{{ e }}</span>
            </div>
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
          <div class="pile-box deck-box" 
               :class="{ 'deck-no-click': !hasRevealedCards(player), 'deck-has-revealed': hasRevealedCards(player) }"
               :title="hasRevealedCards(player) ? '点击查看已知卡牌' : '牌库顺序未知'"
               @click="hasRevealedCards(player) && openRevealedDeck(player?.id)">
            <b>{{player?.deck?.length||0}}</b>
            <span>牌库</span>
            <span v-if="hasRevealedCards(player)" class="deck-revealed-badge">👁️{{myRevealedDeckCards.length}}</span>
            <!-- 魅妖查看提示 -->
            <div v-if="meiYaoViewingAlert" class="meiyao-viewing-alert">
              <span class="meiyao-icon">🎭</span>
              <span>{{ meiYaoViewingAlert.viewerName }} 正在查看你的牌库</span>
            </div>
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
                  <span v-if="s.skill" class="shiki-skill-label skill-cost-display">
                    【启】{{s.skill.name}} 
                    <template v-if="skillCostReduction > 0 && (s.skill.cost || 0) > 0">
                      <span class="cost-original">🔥{{s.skill.cost}}</span>
                      <span class="cost-reduced">🔥{{getActualSkillCost(s.skill.cost || 0)}}</span>
                    </template>
                    <template v-else>
                      🔥{{s.skill.cost||0}}
                    </template>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <!-- 鬼火槽 + 涅槃之火buff图标 -->
          <div class="ghost-fire-row">
            <div class="ghost-fire-bar">
              <div v-for="i in 5" :key="i" class="fire-slot" :class="{active: i <= (player?.ghostFire||0)}"></div>
            </div>
            <!-- 涅槃之火buff图标 -->
            <div v-if="skillCostReduction > 0" class="nirvana-buff-indicator" title="涅槃之火：式神技能鬼火消耗-1">
              <span class="nirvana-icon">🔥</span>
              <span class="nirvana-label">-{{skillCostReduction}}</span>
            </div>
          </div>
        </div>
        
        <!-- 手牌区 -->
        <div class="hand-panel">
          <div class="damage-display">
            <span>⚔️</span><b>{{player?.damage||0}}</b>
          </div>
          <!-- 打出区列表：显示本回合已打出的牌 -->
          <div class="played-area">
            <div class="played-list">
              <div v-for="c in (player?.played || [])" :key="c.instanceId" 
                   class="played-item"
                   @mouseenter="showTooltip($event, c)"
                   @mouseleave="hideTooltip">
                <img v-if="getCardImage(c)" :src="getCardImage(c)" class="played-thumb" />
                <span class="played-name">{{ c.name }}</span>
              </div>
            </div>
            <div class="played-count">
              已打出: {{ player?.played?.length || 0 }} 张
            </div>
          </div>
          <div class="hand-cards">
            <div v-for="(c, idx) in sortedHand" :key="c.instanceId" 
                 class="hand-card" 
                 :class="[cardType(c), {selecting: selectingCards, unplayable: !canPlay(c)}]"
                 :style="{ zIndex: idx + 1 }"
                 @click="handleCardClick(c)"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art hand-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat" v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</div>
                <div class="c-stat" v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">
                  <span class="c-hp-face">❤️{{ yokaiFaceOrPrintedHp(c) }}</span>
                  <template v-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                </div>
                <div class="c-stat" v-else-if="c.cardType === 'penalty'">👑{{ c.charm ?? -1 }}</div>
                <div class="c-stat" v-else>—</div>
              </div>
            </div>
          </div>
        </div>
        <div class="end-panel">
          <button class="end-btn" :class="{ 'not-my-turn': !isMyTurn }" @click="endTurn" :disabled="state?.turnPhase!=='action' || !isMyTurn">
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
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box choice-modal">
            <p class="modal-title">🎯 选择一个效果</p>
            <div class="choice-options">
              <button v-for="(opt, i) in choiceModal.options" :key="i"
                      class="choice-btn" @click="resolveChoice(i)">
                {{opt}}
              </button>
            </div>
          </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：超度选择（唐纸伞妖等御魂效果） -->
      <div class="modal" v-if="salvageChoiceModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box salvage-choice-modal">
          <p class="modal-title">👁️ 查看牌库顶牌</p>
          <p class="modal-hint">{{salvageChoiceModal.prompt}}</p>
          <div class="salvage-card-preview">
            <img v-if="getCardImage(salvageChoiceModal.card)" 
                 :src="getCardImage(salvageChoiceModal.card)" 
                 class="salvage-card-img" />
            <div class="salvage-card-info">
              <div class="salvage-card-name">{{salvageChoiceModal.card?.name}}</div>
              <div class="salvage-card-stats">
                <template v-if="salvageChoiceModal.card?.cardType === 'yokai' || salvageChoiceModal.card?.cardType === 'token'">
                  ❤️{{ yokaiFaceOrPrintedHp(salvageChoiceModal.card!) }}
                </template>
                <template v-else-if="salvageChoiceModal.card?.cardType === 'spell'">
                  ⚔️{{ salvageChoiceModal.card?.damage || 1 }}
                </template>
                <template v-else>❤️{{ salvageChoiceModal.card?.hp ?? 0 }}</template>
                <span v-if="salvageChoiceModal.card?.charm">👑{{salvageChoiceModal.card?.charm}}</span>
              </div>
              <div class="salvage-card-effect">{{salvageChoiceModal.card?.effect}}</div>
            </div>
          </div>
          <div class="salvage-choice-btns">
            <button class="btn primary" @click="handleSalvageChoice(true)">✨ 超度</button>
            <button class="btn secondary" @click="handleSalvageChoice(false)">↩️ 不超度</button>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：地藏像确认（二次确认防误操作） -->
      <div class="modal" v-if="dizangConfirmModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box dizang-confirm-modal">
          <p class="modal-title">🙏 打出地藏像</p>
          <p class="modal-hint">{{ dizangConfirmModal.prompt }}</p>
          <div class="dizang-card-preview" v-if="dizangConfirmModal.card">
            <img v-if="getCardImage(dizangConfirmModal.card)" 
                 :src="getCardImage(dizangConfirmModal.card)" 
                 class="dizang-card-img" />
            <div class="dizang-card-info">
              <div class="dizang-card-name">{{ dizangConfirmModal.card?.name }}</div>
              <div class="dizang-card-stats">❤️{{ dizangConfirmModal.card?.hp }} 👑{{ dizangConfirmModal.card?.charm }}</div>
              <div class="dizang-card-effect">{{ dizangConfirmModal.card?.effect }}</div>
            </div>
          </div>
          <div class="dizang-confirm-btns">
            <button class="btn primary" @click="handleDizangConfirm(true)">✅ 确认打出</button>
            <button class="btn secondary" @click="handleDizangConfirm(false)">❌ 取消</button>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：地藏像式神选择（二选一） -->
      <div class="modal" v-if="dizangSelectModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box dizang-select-modal">
          <p class="modal-title">✨ 选择式神</p>
          <p class="modal-hint">{{ dizangSelectModal.prompt }}</p>
          <div class="dizang-shikigami-grid">
            <div v-for="(s, idx) in dizangSelectModal.candidates" :key="s.id"
                 class="dizang-shikigami-card"
                 @click="handleDizangSelectShikigami(idx)">
              <img v-if="getCardImage(s)" :src="getCardImage(s)" class="shikigami-img" alt="" />
              <div class="shikigami-info">
                <div class="shikigami-name">{{ s.name }}</div>
                <div class="shikigami-skill" v-if="s.skills?.[0]">技能: {{ s.skills[0].name }}</div>
              </div>
            </div>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：地藏像式神置换（式神已满时） -->
      <div class="modal" v-if="dizangReplaceModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box dizang-replace-modal">
          <p class="modal-title">🔄 式神置换</p>
          <p class="modal-hint">{{ dizangReplaceModal.prompt }}</p>
          <div class="dizang-new-shikigami" v-if="dizangReplaceModal.newShikigami">
            <p class="new-shikigami-label">新式神：</p>
            <div class="dizang-shikigami-card highlight">
              <img v-if="getCardImage(dizangReplaceModal.newShikigami)" 
                   :src="getCardImage(dizangReplaceModal.newShikigami)" 
                   class="shikigami-img" alt="" />
              <div class="shikigami-info">
                <div class="shikigami-name">{{ dizangReplaceModal.newShikigami.name }}</div>
              </div>
            </div>
          </div>
          <p class="current-shikigami-label">选择要替换的式神：</p>
          <div class="dizang-shikigami-grid">
            <div v-for="(s, idx) in dizangReplaceModal.currentShikigami" :key="s.id"
                 class="dizang-shikigami-card"
                 @click="handleDizangReplaceShikigami(idx)">
              <img v-if="getCardImage(s)" :src="getCardImage(s)" class="shikigami-img" alt="" />
              <div class="shikigami-info">
                <div class="shikigami-name">{{ s.name }}</div>
              </div>
            </div>
          </div>
          <div class="dizang-replace-btns">
            <button class="btn secondary" @click="handleDizangReplaceShikigami(null)">❌ 放弃获取</button>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：妖怪目标选择（天邪鬼绿等御魂效果） -->
      <div class="modal" v-if="yokaiTargetModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box yokai-target-modal">
          <p class="modal-title">🎯 {{yokaiTargetModal.prompt}}</p>
          <div class="yokai-target-grid">
            <div v-for="y in yokaiTargetModal.candidates" :key="y.instanceId"
                 class="yokai-target-card"
                   @click.stop="handleYokaiTargetChoice(y.instanceId)"
                 @mouseenter="showTooltip($event, y)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(y)" :src="getCardImage(y)" class="yokai-target-img" />
              <div class="yokai-target-info">
                <div class="yokai-target-name">{{y.name}}</div>
                <div class="yokai-target-stat skill-cost-display field-hp-wrap">
                  <template v-if="yokaiHpShowNetCutterStrike(y)">
                    <span class="cost-original">❤️{{getYokaiCurrentHp(y)}}/{{getYokaiMaxHp(y)}}</span>
                    <span class="cost-reduced">❤️{{displayYokaiCurrentHp(y)}}/{{displayYokaiMaxHp(y)}}</span>
                  </template>
                  <template v-else>❤️{{displayYokaiCurrentHp(y)}}/{{displayYokaiMaxHp(y)}}</template>
                </div>
              </div>
            </div>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：镇墓兽禁止退治（左手边玩家） -->
      <div class="modal" v-if="zhenMuShouTargetModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box yokai-target-modal">
            <p class="modal-title">🚫 {{ zhenMuShouTargetModal.prompt }}</p>
            <div class="yokai-target-grid">
              <div
                v-for="y in zhenMuShouTargetModal.candidates"
                :key="y.instanceId"
                class="yokai-target-card"
                @click.stop="handleZhenMuShouTargetChoice(y.instanceId)"
                @mouseenter="showTooltip($event, y)"
                @mouseleave="hideTooltip"
              >
                <img v-if="getCardImage(y)" :src="getCardImage(y)" class="yokai-target-img" />
                <div class="yokai-target-info">
                  <div class="yokai-target-name">{{ y.name }}</div>
                  <div class="yokai-target-stat skill-cost-display field-hp-wrap">
                    <template v-if="yokaiHpShowNetCutterStrike(y)">
                      <span class="cost-original">❤️{{ getYokaiCurrentHp(y) }}/{{ getYokaiMaxHp(y) }}</span>
                      <span class="cost-reduced">❤️{{ displayYokaiCurrentHp(y) }}/{{ displayYokaiMaxHp(y) }}</span>
                    </template>
                    <template v-else>❤️{{ displayYokaiCurrentHp(y) }}/{{ displayYokaiMaxHp(y) }}</template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：卡牌选择（弃牌/超度选择等） -->
      <div class="modal" v-if="cardSelectModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box card-select-modal">
          <p class="modal-title">{{cardSelectModal.title}}</p>
          <p class="modal-hint">{{cardSelectModal.hint || `选择 ${cardSelectModal.count} 张牌`}}</p>
          <div class="card-select-grid" :class="{ 'mei-yao-select-grid': cardSelectModal.layoutVariant === 'meiYao' }">
            <div
              v-for="c in cardSelectModal.candidates"
              :key="c.instanceId"
              class="select-card-slot"
              :class="{ 'mei-yao-slot': cardSelectModal.layoutVariant === 'meiYao' }"
            >
              <div
                class="select-card-item"
                :class="[c.cardType, {selected: cardSelectModal.selected.includes(c.instanceId), unusable: c._usable === false, 'mei-yao-card': cardSelectModal.layoutVariant === 'meiYao', 'empty-deck-slot': c._isEmptyDeck}]"
                @click="c._usable !== false && toggleCardSelect(c.instanceId)"
                @mouseenter="showTooltip($event, c)"
                @mouseleave="hideTooltip"
              >
                <div v-if="c._isEmptyDeck && !getCardImage(c)" class="card-empty-deck-placeholder">
                  <span class="empty-deck-icon">📭</span>
                  <span class="empty-deck-text">无牌可展示</span>
                </div>
                <img v-else-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
                <div class="card-info">
                  <div class="c-name">
                    {{ c.name }}
                    <span v-if="c._ownerName && cardSelectModal.layoutVariant !== 'meiYao'" class="owner-tag">{{ c._ownerName }}</span>
                  </div>
                  <div v-if="!c._isEmptyDeck" class="c-stat">
                    <template v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</template>
                    <template v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">❤️{{ yokaiFaceOrPrintedHp(c) }}</template>
                    <template v-else>❤️{{c.hp ?? 0}}</template>
                  </div>
                </div>
                <div class="select-check" v-if="cardSelectModal.selected.includes(c.instanceId)">✓</div>
                <div class="unusable-badge" v-if="c._usable === false">{{ meiYaoUnusableLabel(c) }}</div>
              </div>
              <div v-if="cardSelectModal.layoutVariant === 'meiYao' && (c._ownerName || c._turnStep != null || (c as any)._ownerId)" class="select-card-owner-below">
                <span class="owner-below-name">{{ c._ownerName }}</span>
                <span v-if="(c as any)._ownerId" class="owner-below-id" :title="String((c as any)._ownerId)">玩家 {{ shortPlayerIdDisplay((c as any)._ownerId) }}</span>
                <span v-if="c._turnStep != null" class="owner-below-order">行动顺序 {{ c._turnStep }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn primary" 
                    :disabled="cardSelectModal.selected.length < cardSelectModal.minCount || cardSelectModal.selected.length > cardSelectModal.maxCount"
                    @click="handleCardSelectConfirm">
              确认{{ cardSelectModal.minCount === 0 ? '（可不选）' : '' }}
            </button>
            <button class="btn secondary" @click="cancelCardSelect" v-if="cardSelectModal.onConfirm || (cardSelectModal as any).allowCancel">
              {{ (cardSelectModal as any).allowCancel ? '跳过' : '取消' }}
            </button>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：目标选择 -->
      <div class="modal" v-if="targetModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box target-modal">
          <p class="modal-title">🎯 选择目标</p>
          <div class="target-grid">
            <div v-for="c in targetModal.candidates" :key="c.instanceId"
                 class="target-card" @click="resolveTarget(c.instanceId)">
              <div class="c-name">{{c.name}}</div>
              <div class="c-stat skill-cost-display field-hp-wrap">
                <template v-if="yokaiHpShowNetCutterStrike(c)">
                  <span class="cost-original">❤️{{getYokaiCurrentHp(c)}}/{{getYokaiMaxHp(c)}}</span>
                  <span class="cost-reduced">❤️{{displayYokaiCurrentHp(c)}}/{{displayYokaiMaxHp(c)}}</span>
                </template>
                <template v-else>❤️{{displayYokaiCurrentHp(c)}}/{{displayYokaiMaxHp(c)}}</template>
              </div>
            </div>
          </div>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 弹窗：赤舌选择（对手选择置于牌库顶的卡牌） -->
      <div class="modal" v-if="akajitaSelectModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box akajita-select-modal">
          <p class="modal-title">👅 赤舌：选择置于牌库顶</p>
          <p class="modal-hint">你的弃牌堆中同时有基础术式和招福达摩，选择一张置于牌库顶</p>
          <div class="akajita-countdown">
            <span class="countdown-icon">⏱️</span>
            <span class="countdown-text">{{ akajitaSelectModal.countdown }}s</span>
            <div class="countdown-bar">
              <div class="countdown-progress" :style="{ width: (akajitaSelectModal.countdown / 5 * 100) + '%' }"></div>
            </div>
          </div>
          <div class="akajita-options akajita-card-pick">
            <button v-for="c in akajitaSelectModal.candidates" :key="c.instanceId"
                    type="button"
                    class="akajita-card-btn"
                    :class="c.name === '基础术式' ? 'spell-btn' : 'token-btn'"
                    @click="handleAkajitaSelect(c.instanceId)">
              <div class="akajita-card-art-wrap">
                <img v-if="getCardImageById(c.cardId)" :src="getCardImageById(c.cardId)!" class="akajita-card-art" alt="" />
                <span v-else class="opt-icon">{{ c.name === '基础术式' ? '📜' : '🎎' }}</span>
              </div>
              <span class="opt-name">{{ c.name }}</span>
            </button>
          </div>
          <p class="akajita-timeout-hint">超时将自动选择【基础术式】</p>
        </div>
        </PendingChoiceShell>
      </div>

      <!-- 赤舌牌库提示浮窗（场景B：自动置顶） -->
      <div v-if="akajitaDeckHint" class="akajita-deck-hint">
        <span class="hint-icon">👅</span>
        <span>已将【{{ akajitaDeckHint.cardName }}】置于牌库顶</span>
      </div>

      <!-- 弹窗：魍魉之匣选择（点选要弃置的牌库顶牌） -->
      <div class="modal" v-if="wangliangModal.show">
        <PendingChoiceShell v-bind="pendingShellProps">
          <div class="modal-box wangliang-modal">
          <p class="modal-title">📦 魍魉之匣</p>
          <p class="modal-hint">默认全部保留，点选要<b>弃置</b>的牌</p>
          <div class="wl-card-row">
            <div v-for="target in wangliangModal.targets" :key="target.playerId"
                 class="wl-card"
                 :class="{ 
                   discarding: target.card && wangliangModal.discardSet.has(target.playerId),
                   empty: !target.card
                 }"
                 @click="target.card && toggleWangliangDiscard(target.playerId)">
              <!-- 玩家名 -->
              <div class="wl-player-tag" :class="{ self: target.isSelf }">
                {{ target.isSelf ? '【自己】' : target.playerName }}
              </div>
              <!-- 有卡牌 -->
              <template v-if="target.card">
                <div class="wl-card-art-wrap">
                  <img v-if="getCardImageById(target.card.cardId)" 
                       :src="getCardImageById(target.card.cardId)" 
                       class="wl-card-art" />
                  <!-- 弃置标记 -->
                  <div class="wl-discard-mark" v-if="wangliangModal.discardSet.has(target.playerId)">🗑️</div>
                </div>
                <div class="wl-card-name">{{ target.card.name }}</div>
                <div class="wl-card-hp">❤️{{ target.card.hp }}</div>
              </template>
              <!-- 空牌库 -->
              <template v-else>
                <div class="wl-card-art-wrap wl-empty-art">
                  <span>空</span>
                </div>
                <div class="wl-card-name wl-empty-text">牌库为空</div>
              </template>
            </div>
          </div>
          <div class="wangliang-actions">
            <button class="confirm-btn" @click="submitWangliangDecisions">
              确认（{{ wangliangModal.discardSet.size > 0 ? `弃置 ${wangliangModal.discardSet.size} 张` : '全部保留' }}）
            </button>
            <button class="cancel-btn" @click="closeWangliangModal">
              取消（全部保留）
            </button>
          </div>
        </div>
        </PendingChoiceShell>
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
                  <template v-else-if="c.cardType === 'yokai' || c.cardType === 'token' || c.type === 'yokai'">
                    <span class="c-hp-face">❤️{{ yokaiFaceOrPrintedHp(c) }}</span>
                    <template v-if="getHandCardEffects(c).length">
                      <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                    </template>
                  </template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty' || c.type === 'penalty'">👑{{ c.charm ?? -1 }}</template>
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
                  <template v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">
                    <span class="c-hp-face">❤️{{ yokaiFaceOrPrintedHp(c) }}</span>
                    <template v-if="getHandCardEffects(c).length">
                      <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                    </template>
                  </template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty'">👑{{ c.charm ?? -1 }}</template>
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
                  <template v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">
                    <span class="c-hp-face">❤️{{ yokaiFaceOrPrintedHp(c) }}</span>
                    <template v-if="getHandCardEffects(c).length">
                      <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                    </template>
                  </template>
                  <template v-else-if="getHandCardEffects(c).length">
                    <span v-for="(eff, i) in getHandCardEffects(c)" :key="i">{{eff.icon}}{{eff.value}}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty'">👑{{ c.charm ?? -1 }}</template>
                  <template v-else>🎁</template>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="empty-hint">弃牌堆为空</p>
          <button class="pile-close-btn" @click="showDiscard=false">关闭</button>
        </div>
      </div>

      <!-- 弹窗：牌库已展示卡牌 -->
      <div class="modal" v-if="showRevealedDeck && viewingRevealedDeck" @click.self="showRevealedDeck=false">
        <div class="pile-view-panel revealed-deck-panel">
          <h2 class="pile-view-title">👁️ {{ viewingRevealedDeck.ownerName }} 的牌库</h2>
          <p class="pile-view-hint">
            已知 {{ viewingRevealedDeck.revealed.length }} 张 / 共 {{ viewingRevealedDeck.deckSize }} 张
          </p>
          
          <!-- 已展示的卡牌 -->
          <div class="pile-card-list" v-if="viewingRevealedDeck.revealed.length">
            <div v-for="c in viewingRevealedDeck.revealed" :key="c.instanceId" 
                 class="pile-card-item revealed-card"
                 :class="c.cardType"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">
                  <template v-if="c.cardType === 'spell'">⚔️{{c.damage||1}}</template>
                  <template v-else-if="c.cardType === 'yokai' || c.cardType === 'token'">
                    <span class="c-hp-face">❤️{{ c.hp || '?' }}</span>
                  </template>
                  <template v-else-if="c.cardType === 'penalty'">👑{{ c.charm ?? -1 }}</template>
                  <template v-else>🎁</template>
                </div>
              </div>
              <span class="revealed-badge">👁️</span>
            </div>
          </div>
          
          <!-- 未知卡牌提示 -->
          <div v-if="viewingRevealedDeck.unknownCount > 0" class="unknown-cards-hint">
            <span class="card-back-icon">🂠</span>
            <span>{{ viewingRevealedDeck.unknownCount }} 张未知卡牌</span>
          </div>
          
          <p v-if="!viewingRevealedDeck.revealed.length" class="empty-hint">暂无已知卡牌</p>
          <button class="pile-close-btn" @click="showRevealedDeck=false">关闭</button>
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
      <div class="card-tooltip" v-if="tooltip.show && !anyModalOpen" :style="tooltipStyle">
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
          <span class="skill-label">
            【{{tooltip.skill.name}} 
            <template v-if="skillCostReduction > 0 && (tooltip.skill.cost || 0) > 0">
              (<span class="cost-original">🔥{{tooltip.skill.cost}}</span> → <span class="cost-reduced">🔥{{getActualSkillCost(tooltip.skill.cost || 0)}}</span>)
            </template>
            <template v-else>
              (🔥{{tooltip.skill.cost}})
            </template>
          </span>
          <p>{{tooltip.skill.effect}}</p>
        </div>
        <div class="tooltip-dynamic" v-if="tooltip.dynamicEffect">
          <p>{{tooltip.dynamicEffect}}</p>
        </div>
      </div>
    </Teleport>
    
    <!-- 日志引用弹出框（卡牌详情） -->
    <Teleport to="body">
      <div class="log-ref-popup" v-if="logRefPopup.show" 
           :class="{ 'boss-popup': logRefPopup.ref?.type === 'boss' }"
           :style="{ left: logRefPopup.x + 'px', top: logRefPopup.y + 'px' }"
           @click.stop>
        <template v-if="logRefPopup.ref">
          <!-- 卡牌类型（妖怪/阴阳术） -->
          <template v-if="logRefPopup.ref.type === 'card' && logRefPopup.ref.data">
            <!-- 上部：卡牌图片区 -->
            <div class="ref-card-image-area">
              <img v-if="getLogRefCardImage(logRefPopup.ref)" 
                   :src="getLogRefCardImage(logRefPopup.ref)" 
                   class="ref-card-img" />
              <div class="ref-card-name-overlay">{{logRefPopup.ref.name}}</div>
              <div class="ref-card-stats-overlay">
                <span v-if="yokaiFaceOrPrintedHp(logRefPopup.ref.data)">❤️{{ yokaiFaceOrPrintedHp(logRefPopup.ref.data) }}</span>
                <span v-if="logRefPopup.ref.data.charm"> 👑{{logRefPopup.ref.data.charm}}</span>
              </div>
            </div>
            <!-- 下部：效果描述区 -->
            <div class="ref-card-effect-area">
              <div class="ref-effect-header">
                <span class="ref-card-title">{{logRefPopup.ref.name}}</span>
                <span class="ref-card-tag">御魂</span>
              </div>
              <div class="ref-effect-cost" v-if="logRefPopup.ref.data.damage">
                <span class="ref-cost-icon">⚔️</span>
                <span class="ref-cost-value">{{logRefPopup.ref.data.damage}}</span>
              </div>
              <div class="ref-effect-desc" v-if="logRefPopup.ref.data.effect">
                {{logRefPopup.ref.data.effect}}
              </div>
              <div class="ref-effect-desc" v-else>
                伤害+{{logRefPopup.ref.data.damage || 0}}
              </div>
            </div>
          </template>
          <!-- 式神类型 -->
          <template v-else-if="logRefPopup.ref.type === 'shikigami' && logRefPopup.ref.data">
            <div class="ref-card-image-area">
              <img v-if="getLogRefCardImage(logRefPopup.ref)" 
                   :src="getLogRefCardImage(logRefPopup.ref)" 
                   class="ref-card-img" />
              <div class="ref-card-name-overlay">{{logRefPopup.ref.name}}</div>
              <div class="ref-card-stats-overlay">
                <span v-if="logRefPopup.ref.data.hp">❤️{{logRefPopup.ref.data.hp}}/{{logRefPopup.ref.data.hp}}</span>
                <span v-if="logRefPopup.ref.data.charm"> 👑{{logRefPopup.ref.data.charm}}</span>
              </div>
            </div>
            <div class="ref-card-effect-area">
              <div class="ref-effect-header">
                <span class="ref-card-title">{{logRefPopup.ref.name}}</span>
                <span class="ref-card-tag shikigami-tag">式神</span>
              </div>
              <div class="ref-effect-cost" v-if="logRefPopup.ref.data.skill?.cost || logRefPopup.ref.data.skillCost">
                <span class="ref-cost-icon">🔥</span>
                <span class="ref-cost-value">{{logRefPopup.ref.data.skill?.cost || logRefPopup.ref.data.skillCost}}</span>
              </div>
              <div class="ref-effect-desc" v-if="logRefPopup.ref.data.skill">
                <template v-if="typeof logRefPopup.ref.data.skill === 'object'">
                  【{{logRefPopup.ref.data.skill.name}}】{{logRefPopup.ref.data.skill.effect}}
                </template>
                <template v-else>
                  {{logRefPopup.ref.data.skill}}
                </template>
              </div>
            </div>
          </template>
          <!-- 鬼王类型 -->
          <template v-else-if="logRefPopup.ref.type === 'boss' && logRefPopup.ref.data">
            <div class="ref-card-image-area boss-image-area">
              <img v-if="getLogRefCardImage(logRefPopup.ref)" 
                   :src="getLogRefCardImage(logRefPopup.ref)" 
                   class="ref-card-img" />
              <div class="ref-card-name-overlay">{{logRefPopup.ref.name}}</div>
              <div class="ref-card-stats-overlay">
                <span>❤️{{logRefPopup.ref.data.hp}}</span>
                <span v-if="logRefPopup.ref.data.charm"> 👑{{logRefPopup.ref.data.charm}}</span>
              </div>
            </div>
            <div class="ref-card-effect-area">
              <div class="ref-effect-header">
                <span class="ref-card-title">{{logRefPopup.ref.name}}</span>
                <span class="ref-card-tag boss-tag">鬼王</span>
              </div>
              <div class="ref-effect-desc" v-if="logRefPopup.ref.data.effect">
                {{logRefPopup.ref.data.effect}}
              </div>
            </div>
          </template>
          <!-- 玩家类型 -->
          <template v-else-if="logRefPopup.ref.type === 'player'">
            <div class="ref-player-area">
              <div class="ref-player-icon">👤</div>
              <div class="ref-player-name">{{logRefPopup.ref.name}}</div>
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
    <!-- 开发用：URL 加 ?devPanel=1（可与 mode=multi 同用），生产构建时完全移除 -->
    <component :is="DevTestPanel" v-if="DevTestPanel && showDevTestPanel" />
    <SettlementToast :trigger="settlementToastTrigger" :text="settlementToastText" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SinglePlayerGame } from './game/SinglePlayerGame'
import { socketClient } from './network/SocketClient'
// DevTestPanel 使用条件动态导入，生产构建时完全移除（Tree-Shaking）
const DevTestPanel = import.meta.env.DEV 
  ? defineAsyncComponent(() => import('./dev/DevTestPanel.vue'))
  : null
import type { GameState, GameLogEntry } from '../../shared/types/game'
import type { CardInstance } from '../../shared/types/cards'
import { fieldHasNetCutter, getNetCutterEffectiveHp } from '../../shared/game/netCutterField'
import PendingChoiceShell from './components/PendingChoiceShell.vue'
import SettlementToast from './components/SettlementToast.vue'

// ── 路由与模式 ──────────────────────────────────────
const route = useRoute()
const router = useRouter()
const isMultiMode = computed(() => route.query.mode === 'multi')

/** 仅开发构建且 URL 含 devPanel=1 时显示右下角测试面板 */
const showDevTestPanel = computed(
  () => import.meta.env.DEV && String(route.query.devPanel) === '1'
)

/** 返回大厅时保留 devPanel 等调试参数 */
function lobbyQueryFromCurrentRoute(): Record<string, string> {
  const q: Record<string, string> = {}
  const d = route.query.devPanel
  if (d !== undefined && String(d) !== '') q.devPanel = String(d)
  return q
}

/**
 * /game?mode=multi 且无状态：可能是 match:found 先跳转、game:started 晚一帧到达。
 * 原逻辑 immediate 会把用户立刻踢回 /，表现为「开局后进不去游戏」。
 * 防抖后再判断是否仍无 room、无 gs，才回大厅。
 */
let multiEmptyKickTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => ({
    multi: isMultiMode.value,
    gs: socketClient.gameState.value,
    room: socketClient.currentRoom.value,
  }),
  ({ multi, gs, room }) => {
    if (multiEmptyKickTimer) {
      clearTimeout(multiEmptyKickTimer)
      multiEmptyKickTimer = null
    }
    if (!multi || gs || room) return
    multiEmptyKickTimer = setTimeout(() => {
      multiEmptyKickTimer = null
      if (!isMultiMode.value) return
      const gs2 = socketClient.gameState.value
      const room2 = socketClient.currentRoom.value
      if (!gs2 && !room2) {
        router.replace({ path: '/', query: lobbyQueryFromCurrentRoute() })
      }
    }, 500)
  },
  { immediate: true }
)

// ── 卡牌图片路径映射 ──────────────────────────────────────
// id格式：boss_001 → 101.webp, yokai_001 → 201.webp, shikigami_001 → 401.webp
// spell_001 → 601.webp, penalty_001 → 701.webp
// 图片编号规则（按 妖怪卡.md 文档顺序）：
//   201 = 招福达摩(token_001)
//   202 = 赤舌(yokai_001), 203 = 唐纸伞妖(yokai_002) ... 239 = 三味(yokai_038)
//   101-110 = 鬼王, 401-424 = 式神, 601-603 = 阴阳术, 701-702 = 恶评
function getCardImage(card: CardInstance | any): string {
  const rawId = card?.cardId || card?.id
  if (!rawId || card?._isEmptyDeck) return ''
  return getCardImageById(rawId)
}

function meiYaoUnusableLabel(c: CardInstance | any): string {
  if (c._isEmptyDeck) return '牌库为空'
  if (c._unusableReason === 'hp_ge_5') return 'HP≥5'
  if (c._unusableReason === 'token_or_penalty') return '不可用'
  if (c._unusableReason === 'boss') return '鬼王'
  return '不可用'
}

/** 魅妖槽位：简要展示座位 id（完整 id 用 title 悬停） */
function shortPlayerIdDisplay(id: string): string {
  if (!id) return ''
  if (id.length <= 10) return id
  return `${id.slice(0, 4)}…${id.slice(-4)}`
}

// 根据 cardId 直接获取卡牌图片路径
function getCardImageById(cardId: string): string {
  if (!cardId) return ''
  const m = String(cardId).match(/^(\w+)_(\d+)$/)
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
  document.addEventListener('click', handleGlobalClick)
  
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
  
  // 初始化时延迟检查并滚动到底部（确保 DOM 已渲染）
  nextTick(() => {
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight
      userIsAtBottom.value = true
    }
  })
})

async function returnToLobby() {
  if (isMultiMode.value && socketClient.currentRoom.value) {
    try {
      await socketClient.leaveRoom()
    } catch (error) {
      console.warn('[App] 返回大厅前离开房间失败:', error)
    }
  }
  router.push({ path: '/', query: lobbyQueryFromCurrentRoute() })
}

// 多人模式：监听游戏状态同步
watch(() => socketClient.gameState.value, (newState) => {
  if (isMultiMode.value && newState) {
    console.log('[App] 多人模式：收到状态更新', newState.phase, newState.turnPhase)
    syncShikigamiCountdownFromState(newState)
    syncTurnCountdownFromState(newState)
    // 移除强制滚动，由 watch(logs) 智能处理
    
    // 监听 pendingChoice：超度选择弹窗（唐纸伞妖等御魂效果）
    if (newState.pendingChoice?.type === 'salvageChoice' && newState.pendingChoice.playerId === myPlayerId.value) {
      salvageChoiceModal.show = true
      salvageChoiceModal.card = newState.pendingChoice.card || null
      salvageChoiceModal.prompt = newState.pendingChoice.prompt || '是否超度这张卡牌？'
    }

    // ===== 地藏像交互监听 =====
    
    // 监听 pendingChoice：地藏像确认弹窗
    if (newState.pendingChoice?.type === 'dizangConfirm' && newState.pendingChoice.playerId === myPlayerId.value) {
      dizangConfirmModal.show = true
      dizangConfirmModal.card = newState.pendingChoice.card || null
      dizangConfirmModal.prompt = newState.pendingChoice.prompt || '确定打出地藏像？此牌将被超度'
    } else if (dizangConfirmModal.show && newState.pendingChoice?.type !== 'dizangConfirm') {
      dizangConfirmModal.show = false
      dizangConfirmModal.card = null
    }

    // 监听 pendingChoice：地藏像式神选择弹窗
    if (newState.pendingChoice?.type === 'dizangSelectShikigami' && newState.pendingChoice.playerId === myPlayerId.value) {
      dizangSelectModal.show = true
      dizangSelectModal.candidates = (newState.pendingChoice as any).candidates || []
      dizangSelectModal.prompt = newState.pendingChoice.prompt || '从2张式神中选择1张'
    } else if (dizangSelectModal.show && newState.pendingChoice?.type !== 'dizangSelectShikigami') {
      dizangSelectModal.show = false
      dizangSelectModal.candidates = []
    }

    // 监听 pendingChoice：地藏像式神置换弹窗
    if (newState.pendingChoice?.type === 'dizangReplaceShikigami' && newState.pendingChoice.playerId === myPlayerId.value) {
      dizangReplaceModal.show = true
      dizangReplaceModal.newShikigami = (newState.pendingChoice as any).newShikigami || null
      dizangReplaceModal.currentShikigami = (newState.pendingChoice as any).currentShikigami || []
      dizangReplaceModal.prompt = newState.pendingChoice.prompt || '选择要替换的式神，或放弃获取'
    } else if (dizangReplaceModal.show && newState.pendingChoice?.type !== 'dizangReplaceShikigami') {
      dizangReplaceModal.show = false
      dizangReplaceModal.newShikigami = null
      dizangReplaceModal.currentShikigami = []
    }
    
    // 监听 pendingChoice：妖怪目标选择弹窗（天邪鬼绿等御魂效果）
    if (newState.pendingChoice?.type === 'yokaiTarget' && newState.pendingChoice.playerId === myPlayerId.value) {
      const targetIds = newState.pendingChoice.options || []
      const me = newState.players.find(p => p.id === myPlayerId.value)
      const blocked = new Set(me?.prohibitedTargets || [])
      const candidates = newState.field.yokaiSlots.filter(
        (y): y is CardInstance => y !== null && targetIds.includes(y.instanceId) && !blocked.has(y.instanceId)
      )
      // 只有当 candidates 存在时才打开；否则确保不再残留旧弹窗
      if (candidates.length > 0) {
        yokaiTargetModal.show = true
        yokaiTargetModal.candidates = candidates
        yokaiTargetModal.prompt = newState.pendingChoice.prompt || '选择目标'
      } else {
        yokaiTargetModal.show = false
        yokaiTargetModal.candidates = []
      }
    } else {
      // pendingChoice 不属于我 或 不存在时，强制关闭防止反复弹窗
      if (yokaiTargetModal.show) {
        yokaiTargetModal.show = false
        yokaiTargetModal.candidates = []
      }
    }

    // 镇墓兽：左手边玩家选择禁止退治目标（pending 归属邻座，非打出者）
    if (newState.pendingChoice?.type === 'zhenMuShouTarget' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const ids: string[] = pc.candidates || []
      const field = newState.field
      const candidates: CardInstance[] = []
      for (const y of field.yokaiSlots) {
        if (y && ids.includes(y.instanceId)) candidates.push(y)
      }
      const boss = field.currentBoss as any
      if (boss && boss.id && ids.includes(boss.id)) {
        candidates.push({
          instanceId: boss.id,
          cardId: boss.cardId || boss.id,
          cardType: 'yokai',
          name: boss.name,
          hp: field.bossCurrentHp ?? boss.hp ?? 0,
          maxHp: boss.hp ?? 0,
        } as CardInstance)
      }
      if (candidates.length > 0) {
        zhenMuShouTargetModal.show = true
        zhenMuShouTargetModal.candidates = candidates
        zhenMuShouTargetModal.prompt = pc.prompt || '选择禁止退治目标'
      } else {
        zhenMuShouTargetModal.show = false
        zhenMuShouTargetModal.candidates = []
      }
    } else {
      if (zhenMuShouTargetModal.show) {
        zhenMuShouTargetModal.show = false
        zhenMuShouTargetModal.candidates = []
      }
    }

    // 监听 pendingChoice：御魂二选一弹窗（天邪鬼青等）；pending 被服务端清空（含 GM 超时回合）时关闭
    if (newState.pendingChoice?.type === 'yokaiChoice' && newState.pendingChoice.playerId === myPlayerId.value) {
      choiceModal.serverYokaiChoice = true
      choiceModal.show = true
      choiceModal.options = newState.pendingChoice.options || []
      choiceModal.resolve = (index: number) => {
        socketClient.send('game:yokaiChoiceResponse', {
          playerId: myPlayerId.value,
          choiceIndex: index
        })
      }
    } else {
      if (choiceModal.show && choiceModal.serverYokaiChoice) {
        choiceModal.show = false
        choiceModal.options = []
        choiceModal.resolve = null
        choiceModal.serverYokaiChoice = false
      }
    }

    // 监听 pendingChoice：多选手牌弹窗（天邪鬼赤等）
    if (newState.pendingChoice?.type === 'selectCardsMulti' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🎴 选择要弃置的手牌'
        cardSelectModal.hint = pc.prompt || '选择手牌（可不选）'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = pc.minCount ?? 0
        cardSelectModal.maxCount = pc.maxCount ?? player.hand.length
        cardSelectModal.count = cardSelectModal.maxCount  // 兼容旧逻辑
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:selectCardsMultiResponse', { selectedIds: ids })
        }
      }
    } else if (newState.pendingChoice?.type === 'selectCardPutTop' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：选1张牌置顶（天邪鬼黄等）
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '📥 选择1张手牌置于牌库顶'
        cardSelectModal.hint = pc.prompt || '选择1张手牌'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:selectCardPutTopResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'treeDemonDiscard' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：树妖弃牌选择
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🗑️ 树妖：选择1张手牌弃置'
        cardSelectModal.hint = pc.prompt || '选择1张手牌弃置'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:treeDemonDiscardResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'naginataSoulDiscard' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：薙魂弃牌（抓牌+1 后必须弃置 1 张，与 SocketServer game:naginataSoulDiscardResponse 对应）
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '⚔️ 薙魂：选择1张手牌弃置'
        cardSelectModal.hint = pc.prompt || '选择1张手牌弃置（含刚抓到的牌）'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:naginataSoulDiscardResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'wheelMonkDiscard' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：轮入道弃牌选择
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player) {
        // 只显示符合条件的御魂（HP≤6）
        const validCards = player.hand.filter((c: any) => pc.candidates?.includes(c.instanceId))
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🔄 轮入道：选择1张御魂弃置'
        cardSelectModal.hint = pc.prompt || '选择1张御魂（效果将执行2次）'
        cardSelectModal.candidates = validCards
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:wheelMonkDiscardResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'tufoSelect' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：涂佛选择弃牌区阴阳术
      const pc = newState.pendingChoice as any
      if (pc.cards && pc.cards.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '📜 涂佛：选择阴阳术置入手牌'
        cardSelectModal.hint = pc.prompt || `选择最多${pc.maxCount}张阴阳术`
        cardSelectModal.candidates = pc.cards  // 直接使用服务端传来的弃牌区阴阳术
        cardSelectModal.minCount = pc.minCount ?? 0
        cardSelectModal.maxCount = pc.maxCount ?? 3
        cardSelectModal.count = pc.maxCount ?? 3
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:tufoSelectResponse', { selectedIds: ids })
        }
      }
    } else if (newState.pendingChoice?.type === 'rinyuChoice' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：日女巳时三选一
      choiceModal.serverYokaiChoice = true
      choiceModal.show = true
      choiceModal.options = ['🔥 鬼火+1', '🎴 抓牌+2', '⚔️ 伤害+2']
      choiceModal.resolve = (index: number) => {
        const choices = ['ghostFire', 'draw', 'damage']
        socketClient.send('game:rinyuChoiceResponse', { choice: choices[index] || 'damage' })
      }
    } else if (newState.pendingChoice?.type === 'bangJingExile' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：蚌精超度手牌选择
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '☁️ 蚌精：选择1张手牌超度'
        cardSelectModal.hint = pc.prompt || '选择1张手牌超度（移出游戏）'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:bangJingExileResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'diceGhostExile' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：骰子鬼第一步 - 选择超度手牌
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🎲 骰子鬼：选择1张手牌超度'
        cardSelectModal.hint = pc.prompt || '超度1张手牌，可退治HP≤(超度牌HP+2)的妖怪'
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:diceGhostExileResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'diceGhostTarget' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：骰子鬼第二步 - 选择退治妖怪
      const pc = newState.pendingChoice as any
      const options = pc.options || []
      if (options.length > 0) {
        // 将妖怪选项转换为 CardInstance 格式以复用 cardSelectModal
        const virtualCards: CardInstance[] = options.map((o: any) => ({
          instanceId: o.instanceId,
          cardId: o.cardId || o.instanceId,
          cardType: 'yokai' as any,
          name: o.name,
          hp: o.hp,
          maxHp: o.hp,
          charm: o.charm ?? 0,
          _slotIndex: o.slotIndex
        }))
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = `🎲 骰子鬼：选择退治目标（HP≤${pc.maxHp}）`
        cardSelectModal.hint = pc.prompt || '选择1个游荡妖怪退治'
        cardSelectModal.candidates = virtualCards
        cardSelectModal.minCount = 1
        cardSelectModal.maxCount = 1
        cardSelectModal.count = 1
        cardSelectModal.selected = []
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:diceGhostTargetResponse', { selectedId: ids[0] || '' })
        }
      }
    } else if (newState.pendingChoice?.type === 'youguXiangSelect' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const maxSel = Math.max(0, Number(pc.maxSelect) || 3)
      const rawDisplay = (pc.displayCandidates || []) as any[]
      const mapYouguSlot = (c: any): CardInstance => {
        const isEmpty = c.isEmptyDeck === true
        const usable = c.usable === true && !isEmpty
        return {
          instanceId: c.instanceId,
          cardId: c.cardId || '',
          cardType: (c.cardType || 'yokai') as CardInstance['cardType'],
          name: c.name || (isEmpty ? '牌库为空' : ''),
          hp: c.hp,
          maxHp: c.hp,
          _ownerName: c.ownerName,
          _ownerId: c.ownerId as string | undefined,
          _turnStep: typeof c.turnStep === 'number' ? c.turnStep : undefined,
          _usable: usable,
          _isEmptyDeck: isEmpty,
          _unusableReason: c.unusableReason as string | undefined,
        }
      }
      let virtualCards: CardInstance[]
      if (rawDisplay.length > 0) {
        virtualCards = rawDisplay.map(mapYouguSlot)
      } else {
        const revealed = pc.revealedCards || []
        const selectable = new Set<string>((pc.selectableCandidates || []) as string[])
        virtualCards = revealed
          .filter((r: any) => r?.card && selectable.has(r.card.instanceId))
          .map((r: any) => ({
            ...r.card,
            _ownerName: r.ownerName,
          }))
      }
      if (virtualCards.length > 0) {
        cardSelectModal.layoutVariant = rawDisplay.length > 0 ? 'meiYao' : ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🔔 幽谷响：选择要执行效果的御魂'
        cardSelectModal.hint = pc.prompt || `最多可选 ${maxSel} 张（可不选）`
        cardSelectModal.candidates = virtualCards
        cardSelectModal.minCount = 0
        cardSelectModal.maxCount = maxSel
        cardSelectModal.count = maxSel
        cardSelectModal.selected = []
        ;(cardSelectModal as any).allowCancel = false
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:youguXiangSelectResponse', { selectedIds: ids })
        }
      }
    } else if (newState.pendingChoice?.type === 'shangHunNiaoExile' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      if (player && player.hand.length > 0) {
        const minC = Math.max(0, Number(pc.minCount) || 0)
        const maxC = Math.max(minC, Number(pc.maxCount) ?? player.hand.length)
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🐦 伤魂鸟：选择要超度的手牌'
        cardSelectModal.hint = pc.prompt || `可选 ${minC}～${maxC} 张，每张 +2 伤害`
        cardSelectModal.candidates = player.hand
        cardSelectModal.minCount = minC
        cardSelectModal.maxCount = maxC
        cardSelectModal.count = maxC
        cardSelectModal.selected = []
        ;(cardSelectModal as any).allowCancel = minC === 0
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:shangHunNiaoResponse', { selectedIds: ids })
        }
      }
    } else if (newState.pendingChoice?.type === 'yinmoluoSelect' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const player = newState.players.find(p => p.id === myPlayerId.value)
      const need = Math.max(1, Number(pc.selectCount) || 2)
      const idSet = new Set<string>((pc.candidates || []).map((c: any) => c.instanceId))
      const full = (player?.discard || []).filter(c => idSet.has(c.instanceId))
      if (player && full.length >= need) {
        cardSelectModal.layoutVariant = ''
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.title = '🌙 阴摩罗：选择弃牌区的牌'
        cardSelectModal.hint = pc.prompt || `须选 ${need} 张（HP<6）`
        cardSelectModal.candidates = full
        cardSelectModal.minCount = need
        cardSelectModal.maxCount = need
        cardSelectModal.count = need
        cardSelectModal.selected = []
        ;(cardSelectModal as any).allowCancel = false
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:yinmoluoSelectResponse', { selectedIds: ids })
        }
      }
    } else if (newState.pendingChoice?.type === 'meiYaoSelect' && newState.pendingChoice.playerId === myPlayerId.value) {
      // 监听 pendingChoice：魅妖选择对手牌库顶牌（服务端按行动顺序含空库与不可选顶牌）
      const pc = newState.pendingChoice as any
      const candidates = pc.candidates || []
      if (candidates.length > 0) {
        const hasUsable = pc.hasUsable !== false
        const virtualCards: CardInstance[] = candidates.map((c: any) => {
          const isEmpty = c.isEmptyDeck === true
          const usable = c.usable === true && !isEmpty
          return {
            instanceId: c.instanceId,
            cardId: c.cardId || '',
            cardType: (c.cardType || 'yokai') as CardInstance['cardType'],
            name: c.name || (isEmpty ? '牌库为空' : ''),
            hp: c.hp,
            maxHp: c.hp,
            _ownerName: c.ownerName,
            _ownerId: c.ownerId as string | undefined,
            _turnStep: typeof c.turnStep === 'number' ? c.turnStep : undefined,
            _usable: usable,
            _isEmptyDeck: isEmpty,
            _unusableReason: c.unusableReason as string | undefined,
          }
        })
        cardSelectModal.isServerMultiSelect = true
        cardSelectModal.show = true
        cardSelectModal.layoutVariant = 'meiYao'
        cardSelectModal.title = '🎭 魅妖：选择对手牌库顶牌'
        cardSelectModal.hint = hasUsable
          ? `选择1张可用牌（HP<5）；按行动顺序展示所有对手`
          : `当前无可用牌库顶，可跳过`
        cardSelectModal.candidates = virtualCards
        cardSelectModal.minCount = hasUsable ? 1 : 0
        cardSelectModal.maxCount = 1
        cardSelectModal.count = hasUsable ? 1 : 0
        cardSelectModal.selected = []
        ;(cardSelectModal as any).allowCancel = !hasUsable
        cardSelectModal.resolve = (ids: string[]) => {
          socketClient.send('game:meiYaoSelectResponse', { selectedCardId: ids[0] || '' })
        }
      }
    }
    
    // 魅妖查看提示：检测是否有人正在查看自己的牌库
    if (newState.pendingChoice?.type === 'meiYaoSelect' && newState.pendingChoice.playerId !== myPlayerId.value) {
      // 其他玩家正在使用魅妖，检查自己的牌库是否被展示
      const myPlayer = newState.players.find(p => p.id === myPlayerId.value)
      if (myPlayer?.revealedDeckCards?.some(r => r.revealedBy === newState.pendingChoice?.playerId)) {
        const viewerPlayer = newState.players.find(p => p.id === newState.pendingChoice?.playerId)
        meiYaoViewingAlert.value = { viewerName: viewerPlayer?.name || '对手' }
      } else {
        meiYaoViewingAlert.value = null
      }
    } else {
      meiYaoViewingAlert.value = null
    }
    
    if (newState.pendingChoice?.type === 'akajitaBatch') {
      const pc = newState.pendingChoice as any
      const mine = pc.targets?.find((t: any) => t.playerId === myPlayerId.value)
      const responded = pc.responses?.[myPlayerId.value]
      if (mine?.candidates?.length >= 2 && !responded) {
        const deadline = Number(pc.deadline) || Number(newState.outOfTurnFeedbackDeadlineAt) || Date.now() + 5000
        akajitaSelectModal.candidates = mine.candidates
        akajitaSelectModal.countdown = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        akajitaSelectModal.show = true
        startAkajitaCountdown(deadline)
      } else if (akajitaSelectModal.show) {
        closeAkajitaSelect()
      }
    } else if (akajitaSelectModal.show) {
      closeAkajitaSelect()
    }
    
    // 赤舌场景B: 检测是否收到自动置顶提示（通过 akajitaNotify 字段）
    const akajitaNotify = (newState as any).akajitaNotify as { playerId: string; cardName: string; timestamp: number }[] | undefined
    if (akajitaNotify && akajitaNotify.length > 0) {
      // 找到给自己的通知（且尚未显示过，通过 timestamp 判断）
      const myNotify = akajitaNotify.find(n => 
        n.playerId === myPlayerId.value && 
        n.timestamp > (lastAkajitaNotifyTimestamp.value || 0)
      )
      if (myNotify) {
        showAkajitaDeckHint(myNotify.cardName)
        lastAkajitaNotifyTimestamp.value = myNotify.timestamp
      }
    }
    
    // 魍魉之匣选择：展示每名玩家牌库顶牌，点选要弃置的
    if (newState.pendingChoice?.type === 'wangliangChoice' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      const allTargets = pc.allTargets || []
      if (allTargets.length > 0 && !wangliangModal.show) {
        wangliangModal.targets = allTargets.map((t: any) => ({
          ...t,
          isSelf: t.playerId === myPlayerId.value
        }))
        wangliangModal.discardSet = new Set()
        wangliangModal.show = true
        console.log('[魍魉之匣] 弹窗显示，全部目标:', allTargets)
      }
    } else if (wangliangModal.show && newState.pendingChoice?.type !== 'wangliangChoice') {
      wangliangModal.show = false
      wangliangModal.targets = []
      wangliangModal.discardSet = new Set()
    }
    
    // 妨害管线 onChoice：返魂香（青女房/铮/弃牌或恶评等）统一 pending
    if (newState.pendingChoice?.type === 'harassmentPipelineChoice' && newState.pendingChoice.playerId === myPlayerId.value) {
      const pc = newState.pendingChoice as any
      choiceModal.show = true
      choiceModal.options = pc.options || []
      choiceModal.serverYokaiChoice = false
      choiceModal.resolve = (choiceIndex: number) => {
        socketClient.send('game:harassmentPipelineChoiceResponse', { choice: choiceIndex })
        choiceModal.show = false
        choiceModal.resolve = null
      }
    }
    
    if (!newState.pendingChoice) {
      // pending 清空时关闭多选弹窗
      if (cardSelectModal.show && cardSelectModal.isServerMultiSelect) {
        cardSelectModal.show = false
        cardSelectModal.isServerMultiSelect = false
        cardSelectModal.selected = []
        cardSelectModal.resolve = null
        cardSelectModal.layoutVariant = ''
      }
      if (choiceModal.show) {
        choiceModal.show = false
        choiceModal.options = []
        choiceModal.resolve = null
        choiceModal.serverYokaiChoice = false
      }
      if (zhenMuShouTargetModal.show) {
        zhenMuShouTargetModal.show = false
        zhenMuShouTargetModal.candidates = []
      }
      closeAkajitaSelect()
    }

    // 超度弹窗：pending 清空时关闭（超时回合等）
    if (!(newState.pendingChoice?.type === 'salvageChoice' && newState.pendingChoice.playerId === myPlayerId.value)) {
      if (salvageChoiceModal.show) {
        salvageChoiceModal.show = false
        salvageChoiceModal.card = null
      }
    }
  }
}, { deep: true })

function handleGameEvent(event: any) {
  if (event.type === 'SHIKIGAMI_SELECT_START') {
    // 事件兜底：晚进入页面的客户端会改为从 state 恢复倒计时
    const timeout = Number(event.timeout) || 20000
    startShikigamiCountdown(timeout)
  }
}

// 多人模式：监听游戏事件（倒计时等）
if (typeof window !== 'undefined') {
  socketClient.on('gameEvent', handleGameEvent)
}

// 组件卸载时的清理
onUnmounted(() => {
  if (multiEmptyKickTimer) {
    clearTimeout(multiEmptyKickTimer)
    multiEmptyKickTimer = null
  }
  document.removeEventListener('click', handleGlobalClick)
  if (chatCooldownTimer) clearInterval(chatCooldownTimer)
  // 解绑 socket 监听，避免页面重进/HMR 后重复注册导致重复日志
  socketClient.off('gameEvent', handleGameEvent)
  socketClient.off('gmResult', handleGMResult)
  clearShikigamiCountdown()
  clearTurnCountdown()
  // 清理赤舌相关计时器
  if (akajitaCountdownTimer) clearInterval(akajitaCountdownTimer)
  if (akajitaDeckHintTimer) clearTimeout(akajitaDeckHintTimer)
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
const showRevealedDeck = ref(false)
const revealedDeckOwner = ref<string | null>(null) // 正在查看谁的牌库展示
const meiYaoViewingAlert = ref<{viewerName: string} | null>(null) // 魅妖正在查看自己牌库的提示
const selectingTarget = ref(false)
const selectingCards = ref(false)

// 多人模式：式神选择倒计时
const shikigamiSelectCountdown = ref(0)
let countdownInterval: number | null = null
const turnCountdown = ref(0)
const turnCountdownMax = ref(0)
let turnCountdownInterval: number | null = null
const showTurnCountdown = computed(() =>
  isMultiMode.value && !!state.value && state.value.phase === 'playing' && state.value.turnPhase === 'action'
)
const turnCountdownDisplay = computed(() => {
  const s = state.value as any
  if (
    isMultiMode.value &&
    s?.turnTimerPaused &&
    s?.turnPausedRemainMs != null
  ) {
    const sec = Math.max(0, Math.ceil(Number(s.turnPausedRemainMs) / 1000))
    return `${sec}s（等待他人时已暂停）`
  }
  return turnCountdownMax.value <= 0 ? '∞' : `${Math.max(0, turnCountdown.value)}s`
})

/** 多人：当前回合玩家正在等他人完成 pendingChoice */
const multiplayerWaitingForOffTurnFeedback = computed(() => {
  if (!isMultiMode.value || !state.value) return false
  if (state.value.phase !== 'playing' || state.value.turnPhase !== 'action') return false
  if (!isMyTurn.value) return false
  const pc = state.value.pendingChoice as { playerId?: string } | undefined
  if (!pc?.playerId) return false
  return pc.playerId !== myPlayerId.value
})

/** §5.5：与 state.pendingChoice 同步的弹窗外壳（来源 / 步骤说明 / 计时） */
const pendingShellBind = computed(() => {
  const st = state.value as Record<string, unknown> | null | undefined
  if (!st?.pendingChoice) return null
  const pc = st.pendingChoice as Record<string, unknown>
  if (pc.playerId !== myPlayerId.value) return null
  const players = st.players as { id: string }[]
  const curPid = players[(st.currentPlayerIndex as number) ?? 0]?.id
  let timerMode: 'turnTotal' | 'offTurnResponse' =
    pc.playerId === curPid ? 'turnTotal' : 'offTurnResponse'
  if (pc.timerMode === 'turnTotal' || pc.timerMode === 'offTurnResponse') {
    timerMode = pc.timerMode as 'turnTotal' | 'offTurnResponse'
  }
  const sourceCard = (pc.sourceCard ?? pc.card) as CardInstance | undefined
  const stepSummary = String(pc.stepSummary ?? pc.prompt ?? '')
  const fullRules = sourceCard?.effect ? String(sourceCard.effect) : ''
  const sourceLabel = String(
    pc.sourceLabel ?? (timerMode === 'offTurnResponse' ? '妨害响应' : '')
  )
  const sourceCardName = sourceCard?.name ? String(sourceCard.name) : ''
  const sourceImageUrl = sourceCard ? getCardImage(sourceCard) : ''
  const showTimer =
    isMultiMode.value &&
    st.phase === 'playing' &&
    st.turnPhase === 'action'

  return {
    stepSummary,
    fullRulesText: fullRules || '（暂无完整规则文本）',
    sourceLabel,
    sourceCardName,
    sourceImageUrl,
    timerMode,
    turnCountdownSec: turnCountdown.value,
    turnCountdownMaxSec: turnCountdownMax.value,
    offTurnDeadlineAt: (st.outOfTurnFeedbackDeadlineAt as number) ?? null,
    showTimer,
  }
})

const pendingShellProps = computed(() => ({
  ...(pendingShellBind.value || {
    stepSummary: '',
    fullRulesText: '（暂无完整规则文本）',
    sourceLabel: '',
    sourceCardName: '',
    sourceImageUrl: '',
    timerMode: 'turnTotal' as const,
    turnCountdownSec: 0,
    turnCountdownMaxSec: 0,
    offTurnDeadlineAt: null,
    showTimer: false,
  }),
  showChrome: !!pendingShellBind.value,
}))

const settlementToastTrigger = ref(0)
const settlementToastText = ref('')
let lastSettlementDedupeKey: string | null = null
/** pending 步骤切换时与上次不同的 key，用于同类型多段仍可再提示 */
let lastPendingChoiceToastKey = ''

function bumpSettlementToastFromServer(text: string, dedupeKey: string) {
  if (!text.trim()) return
  if (dedupeKey === lastSettlementDedupeKey) return
  lastSettlementDedupeKey = dedupeKey
  settlementToastText.value = text.trim()
  settlementToastTrigger.value++
}

watch(
  () => (state.value as GameState & { settlementToast?: Record<string, unknown> })?.settlementToast,
  (toast) => {
    if (!toast || !myPlayerId.value) return
    const ids = (toast.recipientPlayerIds as string[]) || []
    if (!ids.includes(myPlayerId.value)) return
    const key = `st:${toast.logSeq ?? ''}|${toast.timestamp}|${toast.message}`
    bumpSettlementToastFromServer(String(toast.message ?? ''), key)
  },
  { deep: true }
)

/** §5.5：多段 pending 切换时，未带 settlementToastFor 的日志也能在中部淡出当前步骤说明 */
watch(
  () => {
    const pc = state.value?.pendingChoice as Record<string, unknown> | undefined
    if (!pc || !myPlayerId.value) return ''
    if (pc.playerId !== myPlayerId.value) return ''
    const text = String(pc.stepSummary || pc.prompt || '').trim()
    if (!text) return ''
    return `${String(pc.type)}|${text}`
  },
  (key) => {
    if (!myPlayerId.value) return
    if (!key) {
      lastPendingChoiceToastKey = ''
      return
    }
    if (key === lastPendingChoiceToastKey) return
    lastPendingChoiceToastKey = key
    const pc = state.value?.pendingChoice as Record<string, unknown> | undefined
    const text = String(pc?.stepSummary || pc?.prompt || '').trim()
    if (!text) return
    bumpSettlementToastFromServer(text, `pc:${key}|${state.value?.lastUpdate ?? 0}`)
  }
)

function clearShikigamiCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function clearTurnCountdown() {
  if (turnCountdownInterval) {
    clearInterval(turnCountdownInterval)
    turnCountdownInterval = null
  }
}

function startShikigamiCountdown(timeoutMs: number, startTime?: number) {
  if (typeof window === 'undefined') return

  clearShikigamiCountdown()

  const elapsed = startTime ? Math.max(0, Date.now() - startTime) : 0
  const remainMs = Math.max(0, timeoutMs - elapsed)
  shikigamiSelectCountdown.value = Math.ceil(remainMs / 1000)

  if (shikigamiSelectCountdown.value <= 0) return

  countdownInterval = window.setInterval(() => {
    if (shikigamiSelectCountdown.value > 0) {
      shikigamiSelectCountdown.value--
      return
    }
    clearShikigamiCountdown()
  }, 1000)
}

function syncShikigamiCountdownFromState(newState: any) {
  if (!isMultiMode.value) return

  if (!newState || newState.phase !== 'shikigamiSelect') {
    shikigamiSelectCountdown.value = 0
    clearShikigamiCountdown()
    return
  }

  const timeoutMs = Number(newState.shikigamiSelectTimeout) || 0
  const startTime = Number(newState.shikigamiSelectStartTime) || 0
  if (timeoutMs <= 0 || startTime <= 0) return

  const remainSec = Math.ceil(Math.max(0, timeoutMs - (Date.now() - startTime)) / 1000)
  // 只在首次或出现明显漂移时重建，避免每次 stateSync 都重置倒计时动画
  if (!countdownInterval || Math.abs(remainSec - shikigamiSelectCountdown.value) > 1) {
    startShikigamiCountdown(timeoutMs, startTime)
  }
}

function startTurnCountdown(timeoutMs: number, startTime?: number) {
  if (typeof window === 'undefined') return
  clearTurnCountdown()
  const maxSec = Math.ceil(Math.max(0, timeoutMs) / 1000)
  turnCountdownMax.value = maxSec
  const elapsed = startTime ? Math.max(0, Date.now() - startTime) : 0
  const remainMs = Math.max(0, timeoutMs - elapsed)
  turnCountdown.value = Math.ceil(remainMs / 1000)
  if (timeoutMs <= 0 || turnCountdown.value <= 0) return
  turnCountdownInterval = window.setInterval(() => {
    if (turnCountdown.value > 0) {
      turnCountdown.value--
      return
    }
    clearTurnCountdown()
  }, 1000)
}

function syncTurnCountdownFromState(newState: any) {
  if (!isMultiMode.value) return
  if (!newState || newState.phase !== 'playing' || newState.turnPhase !== 'action') {
    turnCountdown.value = 0
    turnCountdownMax.value = 0
    clearTurnCountdown()
    return
  }
  if (newState.turnTimerPaused && newState.turnPausedRemainMs != null) {
    clearTurnCountdown()
    const sec = Math.max(0, Math.ceil(Number(newState.turnPausedRemainMs) / 1000))
    turnCountdown.value = sec
    turnCountdownMax.value = Math.max(1, sec)
    return
  }
  const timeoutMs = Number(newState.turnTimeoutMs) || 0
  if (timeoutMs <= 0) {
    turnCountdown.value = 0
    turnCountdownMax.value = 0
    clearTurnCountdown()
    return
  }
  const startAt = Number(newState.turnStartAt) || 0
  const remainSec = Math.ceil(Math.max(0, timeoutMs - (Date.now() - startAt)) / 1000)
  if (!turnCountdownInterval || Math.abs(remainSec - turnCountdown.value) > 1 || turnCountdownMax.value !== Math.ceil(timeoutMs / 1000)) {
    startTurnCountdown(timeoutMs, startAt)
  }
}

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
  dynamicEffect: string | null  // 三味、狂骨等卡牌的动态效果预览
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
  skill: null,
  dynamicEffect: null
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

// 效果选择弹窗（单人 / 多人退治超度 Promise / 多人服务端 yokaiChoice 共用）
const choiceModal = reactive<{
  show: boolean
  options: string[]
  resolve: ((index: number) => void) | null
  /** 多人：由 state.pendingChoice.yokaiChoice 驱动，超时/服务端收口需在 state 清空时关窗 */
  serverYokaiChoice: boolean
}>({
  show: false,
  options: [],
  resolve: null,
  serverYokaiChoice: false
})

// 卡牌选择弹窗
const cardSelectModal = reactive<{
  show: boolean
  title: string
  hint: string
  candidates: CardInstance[]
  count: number
  minCount: number
  maxCount: number
  selected: string[]
  resolve: ((ids: string[]) => void) | null
  onConfirm: (() => void) | null
  isServerMultiSelect: boolean  // 是否为服务端多选（天邪鬼赤等）
  /** 魅妖等专用布局：玩家标签在卡牌下方、多列适配 */
  layoutVariant: '' | 'meiYao'
}>({
  show: false,
  title: '选择卡牌',
  hint: '',
  candidates: [],
  count: 1,
  minCount: 1,
  maxCount: 1,
  selected: [],
  resolve: null,
  onConfirm: null,
  isServerMultiSelect: false,
  layoutVariant: '',
})

// 超度选择弹窗（唐纸伞妖等御魂效果）
const salvageChoiceModal = reactive<{
  show: boolean
  card: CardInstance | null
  prompt: string
}>({
  show: false,
  card: null,
  prompt: ''
})

// 地藏像确认弹窗
const dizangConfirmModal = reactive<{
  show: boolean
  card: CardInstance | null
  prompt: string
}>({
  show: false,
  card: null,
  prompt: ''
})

// 地藏像式神选择弹窗（二选一）
const dizangSelectModal = reactive<{
  show: boolean
  candidates: any[]  // ShikigamiCard[]
  prompt: string
}>({
  show: false,
  candidates: [],
  prompt: ''
})

// 地藏像式神置换弹窗（式神已满时）
const dizangReplaceModal = reactive<{
  show: boolean
  newShikigami: any | null  // ShikigamiCard
  currentShikigami: any[]   // ShikigamiCard[]
  prompt: string
}>({
  show: false,
  newShikigami: null,
  currentShikigami: [],
  prompt: ''
})

// 妖怪目标选择弹窗（天邪鬼绿等御魂效果）
const yokaiTargetModal = reactive<{
  show: boolean
  candidates: CardInstance[]
  prompt: string
}>({
  show: false,
  candidates: [],
  prompt: ''
})

// 赤舌选择弹窗（对手选择置于牌库顶的卡牌）
const akajitaSelectModal = reactive<{
  show: boolean
  countdown: number
  candidates: { instanceId: string; cardId: string; name: string }[]
}>({
  show: false,
  countdown: 5,
  candidates: []
})
let akajitaCountdownTimer: number | null = null

// 赤舌牌库提示（显示自动置于牌库顶的卡牌）
const akajitaDeckHint = ref<{ cardName: string } | null>(null)
let akajitaDeckHintTimer: number | null = null
const lastAkajitaNotifyTimestamp = ref<number>(0) // 用于避免重复显示通知

// 魍魉之匣选择弹窗（点选要弃置的牌库顶牌，未选中则保留）
const wangliangModal = reactive<{
  show: boolean
  targets: { playerId: string; playerName: string; isSelf: boolean; card: { instanceId: string; cardId: string; name: string; hp: number; cardType: string } | null }[]
  discardSet: Set<string>  // 被选中弃置的 playerId 集合
}>({
  show: false,
  targets: [],
  discardSet: new Set()
})

// 切换某玩家的弃置状态（仅对有牌的玩家有效）
function toggleWangliangDiscard(playerId: string) {
  if (wangliangModal.discardSet.has(playerId)) {
    wangliangModal.discardSet.delete(playerId)
  } else {
    wangliangModal.discardSet.add(playerId)
  }
}

// 提交魍魉之匣决策：discardSet 中的=弃置，其余=保留
function submitWangliangDecisions() {
  // 只为有牌库的玩家生成决策
  const decisions = wangliangModal.targets
    .filter(t => t.card !== null)
    .map(t => ({
      playerId: t.playerId,
      action: (wangliangModal.discardSet.has(t.playerId) ? 'discard' : 'keep') as 'keep' | 'discard'
    }))
  
  socketClient.send('game:wangliangBatchResponse', { decisions })
  wangliangModal.show = false
  wangliangModal.targets = []
  wangliangModal.discardSet = new Set()
}

// 关闭魍魉之匣弹窗（取消/超时时默认全部保留）
function closeWangliangModal() {
  const decisions = wangliangModal.targets
    .filter(t => t.card !== null)
    .map(t => ({
      playerId: t.playerId,
      action: 'keep' as const
    }))
  socketClient.send('game:wangliangBatchResponse', { decisions })
  wangliangModal.show = false
  wangliangModal.targets = []
  wangliangModal.discardSet = new Set()
}

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

/** 多人：镇墓兽 — 左手边玩家选禁止退治目标 */
const zhenMuShouTargetModal = reactive<{
  show: boolean
  candidates: CardInstance[]
  prompt: string
}>({
  show: false,
  candidates: [],
  prompt: '',
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

// 获取指定玩家对当前玩家可见的已展示牌库卡牌
function getVisibleRevealedCards(targetPlayer: any): any[] {
  if (!targetPlayer?.revealedDeckCards?.length || !targetPlayer?.deck?.length) return []
  if (!player.value) return []
  
  const myId = player.value.id
  const ownerId = targetPlayer.id
  
  // 过滤可见的展示卡牌（触发者或拥有者可见）
  const visibleInstanceIds = new Set(
    targetPlayer.revealedDeckCards
      .filter((r: any) => r.revealedBy === myId || ownerId === myId)
      .map((r: any) => r.instanceId)
  )
  
  // 返回牌库中对应的卡牌实例
  return targetPlayer.deck.filter((c: any) => visibleInstanceIds.has(c.instanceId))
}

// 当前玩家自己的牌库是否有可见的展示卡牌
const myRevealedDeckCards = computed(() => {
  if (!player.value) return []
  return getVisibleRevealedCards(player.value)
})

// 检查玩家牌库是否有可展示的卡牌
function hasRevealedCards(p: any): boolean {
  return getVisibleRevealedCards(p).length > 0
}

// 打开牌库展示弹窗
function openRevealedDeck(targetPlayerId: string) {
  revealedDeckOwner.value = targetPlayerId
  showRevealedDeck.value = true
}

// 获取正在查看的牌库展示信息
const viewingRevealedDeck = computed(() => {
  if (!showRevealedDeck.value || !revealedDeckOwner.value || !state.value) return null
  const targetPlayer = state.value.players.find(p => p.id === revealedDeckOwner.value)
  if (!targetPlayer) return null
  
  const revealed = getVisibleRevealedCards(targetPlayer)
  const deckSize = targetPlayer.deck?.length || 0
  const unknownCount = deckSize - revealed.length
  
  return {
    ownerName: targetPlayer.name,
    ownerId: targetPlayer.id,
    revealed,
    unknownCount,
    deckSize
  }
})

// 是否轮到自己行动
const isMyTurn = computed(() => {
  if (!state.value) return false
  if (isMultiMode.value) {
    // 式神选择阶段全员同步选人，不进入回合制行动
    if (state.value.phase === 'shikigamiSelect') return false
    return state.value.currentPlayerIndex === myPlayerIndex.value
  }
  return true // 单人模式始终是自己的回合
})
const yokai = computed(() => state.value?.field.yokaiSlots || [])
const boss = computed(() => state.value?.field.currentBoss)

/** 镇墓兽：任意座位 prohibitedTargets 中的目标 id（游荡妖怪 instanceId / 鬼王 id），用于全场盾标 */
const zhenMuShouShieldTargetIds = computed(() => {
  const ps = state.value?.players
  if (!ps?.length) return new Set<string>()
  const s = new Set<string>()
  for (const p of ps) {
    for (const id of p.prohibitedTargets || []) s.add(id)
  }
  return s
})

function isZhenMuShouShieldOnYokai(y: CardInstance): boolean {
  return zhenMuShouShieldTargetIds.value.has(y.instanceId)
}

const isZhenMuShouShieldVisibleForBoss = computed(() => {
  const b = boss.value
  if (!b?.id) return false
  return zhenMuShouShieldTargetIds.value.has(b.id)
})

function isZhenMuBlockedForMe(targetInstanceId: string): boolean {
  return !!(player.value?.prohibitedTargets?.includes(targetInstanceId))
}

const isZhenMuBlockedForBoss = computed(() => {
  const b = boss.value
  if (!b?.id) return false
  return isZhenMuBlockedForMe(b.id)
})
/** 场上鬼王：网切等 buff 下的展示 HP（与结算有效生命一致） */
const displayBossMaxHp = computed(() => {
  const f = state.value?.field
  const b = f?.currentBoss
  if (!f || !b) return b?.hp ?? 0
  return getNetCutterEffectiveHp(f, b.hp, 'boss')
})
const displayBossCurrentHp = computed(() => {
  const f = state.value?.field
  const b = f?.currentBoss
  if (!f || !b) return 0
  const raw = f.bossCurrentHp ?? b.hp
  return getNetCutterEffectiveHp(f, raw, 'boss')
})
/** 鬼王卡面：印刷血量（划线原值），用于网切与涅槃之火同风格的 HP 展示 */
const bossHpRawMax = computed(() => state.value?.field.currentBoss?.hp ?? 0)
const bossHpRawCurrent = computed(() => {
  const f = state.value?.field
  const b = f?.currentBoss
  if (!f || !b) return 0
  return f.bossCurrentHp ?? b.hp
})
const showBossHpNetCutterStrike = computed(() => {
  const f = state.value?.field
  if (!f || !fieldHasNetCutter(f)) return false
  return (
    displayBossCurrentHp.value !== bossHpRawCurrent.value ||
    displayBossMaxHp.value !== bossHpRawMax.value
  )
})
const logs = computed(() => (state.value?.log || []).slice(-300))

// 手牌排序显示：不能使用的居左，能使用的居右，内部保持原顺序
const sortedHand = computed(() => {
  const hand = player.value?.hand || []
  if (hand.length === 0) return []
  
  // 为每张牌添加原始索引，用于保持内部顺序
  const indexed = hand.map((c, idx) => ({ card: c, originalIndex: idx }))
  
  // 简化判断：不能打出的牌（令牌/恶评/非自己回合等）
  const canPlayCard = (c: any): boolean => {
    // 令牌和恶评永远不能打出
    if (c.cardType === 'token' || c.name === '招福达摩') return false
    if (c.cardType === 'penalty') return false
    if (c.cardType === 'shikigami') return false
    // 非自己回合不能打出
    if (isMultiMode.value && !isMyTurn.value) return false
    if (state.value?.turnPhase !== 'action') return false
    return true
  }
  
  // 分成两组：不能用的 和 能用的
  const unplayable = indexed.filter(item => !canPlayCard(item.card))
  const playable = indexed.filter(item => canPlayCard(item.card))
  
  // 各组内部按原始索引排序（保持抓牌顺序）
  unplayable.sort((a, b) => a.originalIndex - b.originalIndex)
  playable.sort((a, b) => a.originalIndex - b.originalIndex)
  
  // 不能用的在左，能用的在右
  return [...unplayable, ...playable].map(item => item.card)
})

/** 客户端直接向 log 写入时使用（与服务器 logSeq 区分区间） */
let clientDirectLogSeq = 1_000_000_000
function takeClientDirectLogSeq(): number {
  return clientDirectLogSeq++
}

/** v-for 行 key：禁止仅用 timestamp（同毫秒内多条日志会导致 Vue 复用错乱、出现多行相同内容） */
function logEntryRowKey(l: any, i: number): string | number {
  if (l.logSeq != null) return l.logSeq
  return `i${i}-t${l.timestamp}-m${String(l.message || '').slice(0, 24)}`
}

// ====== 智能滚动系统 ======
const hasNewMessage = ref(false)
let lastLogLength = 0 // 追踪上次日志长度，用于检测新消息
let autoScrolling = false // 标记是否正在自动滚动中，避免批量消息竞态
// 用 ref 追踪用户是否在底部，确保响应性
const userIsAtBottom = ref(true)

// 检测用户是否在底部（最新消息是否在可视区域）
function checkIsAtBottom(): boolean {
  if (!logRef.value) return true
  const el = logRef.value
  const threshold = 50 // 允许50px的误差（增加容错）
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

// 用户滚动时的处理 - 实时更新底部状态
function handleLogScroll() {
  const atBottom = checkIsAtBottom()
  userIsAtBottom.value = atBottom
  // 如果用户滚动到底部，清除新消息提示
  if (atBottom) {
    hasNewMessage.value = false
  }
}

// 滚动到底部（点击"有新消息"按钮时调用）
function scrollToBottom() {
  if (logRef.value) {
    logRef.value.scrollTop = logRef.value.scrollHeight
    hasNewMessage.value = false
    userIsAtBottom.value = true
  }
}

// 监听日志变化 - 使用长度追踪避免computed数组比较问题
watch(() => state.value?.log?.length ?? 0, (newLen, oldLen) => {
  // 只在新增消息时处理
  if (newLen <= 0) return
  if (newLen <= lastLogLength) {
    lastLogLength = newLen
    return
  }
  
  const addedCount = newLen - lastLogLength
  const prevLogLen = lastLogLength
  lastLogLength = newLen

  // §5.5：日志条目上携带的 settlementToastRecipients / settlementToastText（与信息栏同源可读文案）
  if (isMultiMode.value && myPlayerId.value) {
    const logArr = state.value?.log
    if (logArr && addedCount > 0) {
      const from = Math.max(0, prevLogLen)
      const to = Math.min(logArr.length, from + addedCount)
      for (let i = from; i < to; i++) {
        const e = logArr[i] as GameLogEntry & {
          settlementToastRecipients?: string[]
          settlementToastText?: string
        }
        const ids = e.settlementToastRecipients
        const txt = e.settlementToastText
        if (!ids?.includes(myPlayerId.value) || !txt?.trim()) continue
        bumpSettlementToastFromServer(
          txt,
          `log:${e.logSeq ?? i}|${e.timestamp}|${txt}`
        )
      }
    }
  }
  
  // 如果正在自动滚动中（批量消息场景），直接滚动不判断
  if (autoScrolling) {
    nextTick(() => {
      if (logRef.value) {
        logRef.value.scrollTop = logRef.value.scrollHeight
      }
    })
    return
  }
  
  // 使用 ref 追踪的底部状态，确保响应性
  const wasAtBottom = userIsAtBottom.value
  
  nextTick(() => {
    if (wasAtBottom) {
      // 之前在底部，自动滚动到新消息
      autoScrolling = true
      if (logRef.value) {
        logRef.value.scrollTop = logRef.value.scrollHeight
      }
      hasNewMessage.value = false // 确保清除提示
      userIsAtBottom.value = true // 滚动后仍在底部
      // 100ms后重置标记，允许处理下一批消息
      setTimeout(() => { autoScrolling = false }, 100)
    } else {
      // 不在底部，显示新消息提示
      hasNewMessage.value = true
      console.log('[智能滚动] 显示新消息提示, 新增', addedCount, '条消息')
    }
  })
}, { immediate: true })

// 日志引用对象点击状态
const logRefPopup = ref<{
  show: boolean;
  ref: any;
  x: number;
  y: number;
}>({ show: false, ref: null, x: 0, y: 0 })

// ====== 聊天系统 ======
const chatInputRef = ref<HTMLInputElement | null>(null)
const chatInputText = ref('')
const chatInputHistory = ref<string[]>([])
let chatHistoryIndex = -1
let chatDraftBeforeHistory = ''
const showEmojiPanel = ref(false)
const chatCooldownRemaining = ref(0)
let chatCooldownTimer: ReturnType<typeof setInterval> | null = null

const emojiList = [
  '😀','😂','😅','😭','😡','🤔','😎','🥺',
  '😏','😤','😱','🤣','👍','👎','❤️','💔',
  '🔥','✨','🎉','💪','😴','🙏','👀','💬',
]

const chatInputPlaceholder = computed(() => {
  if (chatInputText.value.startsWith('/')) return '输入GM指令...'
  if (chatCooldownRemaining.value > 0) return `冷却中 (${chatCooldownRemaining.value}s)`
  return '说点什么...'
})

// GM指令历史
const gmCommandHistory = ref<string[]>([])
let gmHistoryIndex = -1

function handleChatInputChange() {
  // 用户手动输入时，退出历史浏览状态
  if (chatHistoryIndex !== -1) {
    chatHistoryIndex = -1
    chatDraftBeforeHistory = ''
  }
}

function rememberChatInputHistory(text: string) {
  const normalized = text.trim()
  if (!normalized) return
  if (chatInputHistory.value[0] === normalized) return
  chatInputHistory.value.unshift(normalized)
  if (chatInputHistory.value.length > 50) chatInputHistory.value.pop()
  chatHistoryIndex = -1
  chatDraftBeforeHistory = ''
}

function handleChatSend() {
  const text = chatInputText.value.trim()
  if (!text) return

  if (text.startsWith('/')) {
    // GM 指令
    const command = text.slice(1)
    gmCommandHistory.value.unshift(text)
    if (gmCommandHistory.value.length > 20) gmCommandHistory.value.pop()
    gmHistoryIndex = -1

    if (isMultiMode.value) {
      socketClient.sendGMCommand(command).catch(err => {
        console.error('[Chat] GM指令失败:', err)
      })
    } else {
      // 单人模式本地处理GM指令
      handleLocalGMCommand(command)
    }
    rememberChatInputHistory(text)
  } else {
    // 聊天消息
    if (chatCooldownRemaining.value > 0) return

    if (isMultiMode.value) {
      socketClient.sendChat(text).catch(err => {
        console.error('[Chat] 发送失败:', err)
      })
    } else {
      // 单人模式本地添加聊天记录
      addLocalChatLog(text)
    }
    rememberChatInputHistory(text)

    // 启动冷却
    startChatCooldown()
  }

  chatInputText.value = ''
  showEmojiPanel.value = false
}

function focusChatInputToEnd() {
  nextTick(() => {
    const input = chatInputRef.value
    if (!input) return
    input.focus()
    const pos = chatInputText.value.length
    input.setSelectionRange(pos, pos)
  })
}

function handleChatHistoryUp() {
  if (chatInputHistory.value.length === 0) return

  if (chatHistoryIndex === -1) {
    chatDraftBeforeHistory = chatInputText.value
  }

  if (chatHistoryIndex < chatInputHistory.value.length - 1) {
    chatHistoryIndex++
    chatInputText.value = chatInputHistory.value[chatHistoryIndex] || ''
    focusChatInputToEnd()
  }
}

function handleChatHistoryDown() {
  if (chatInputHistory.value.length === 0 || chatHistoryIndex === -1) return

  chatHistoryIndex--
  if (chatHistoryIndex >= 0) {
    chatInputText.value = chatInputHistory.value[chatHistoryIndex] || ''
  } else {
    chatInputText.value = chatDraftBeforeHistory
    chatDraftBeforeHistory = ''
  }
  focusChatInputToEnd()
}

function handleLocalGMCommand(command: string) {
  const [cmd, ...args] = command.split(' ')
  let resultMsg = ''
  switch (cmd.toLowerCase()) {
    case 'help':
      resultMsg = '可用指令: /help, /status, /ping'
      break
    case 'status':
      resultMsg = `游戏阶段: ${state.value?.phase || '未知'}，回合: ${state.value?.turnNumber || 0}`
      break
    case 'ping':
      resultMsg = `Pong! 本地时间: ${new Date().toLocaleTimeString()}`
      break
    default:
      resultMsg = `未知指令 /${cmd}，输入 /help 查看可用指令`
  }
  // 在日志中显示GM结果
  if (state.value) {
    state.value.log.push({
      type: 'chat' as any,
      message: `⚙️ [GM] ${resultMsg}`,
      timestamp: Date.now(),
      logSeq: takeClientDirectLogSeq(),
      visibility: 'private',
      playerId: player.value?.id,
    })
  }
}

function addLocalChatLog(content: string) {
  if (state.value) {
    const pName = player.value?.name || '玩家'
    state.value.log.push({
      type: 'chat' as any,
      message: `💬 [${pName}] ${content}`,
      timestamp: Date.now(),
      logSeq: takeClientDirectLogSeq(),
      visibility: 'public',
      chatData: {
        senderId: player.value?.id || '',
        senderName: pName,
        rawContent: content,
      },
    })
  }
}

function startChatCooldown() {
  chatCooldownRemaining.value = 5
  if (chatCooldownTimer) clearInterval(chatCooldownTimer)
  chatCooldownTimer = setInterval(() => {
    chatCooldownRemaining.value--
    if (chatCooldownRemaining.value <= 0) {
      chatCooldownRemaining.value = 0
      if (chatCooldownTimer) {
        clearInterval(chatCooldownTimer)
        chatCooldownTimer = null
      }
    }
  }, 1000)
}

function insertEmoji(emoji: string) {
  const input = chatInputRef.value
  if (input) {
    const start = input.selectionStart || chatInputText.value.length
    const end = input.selectionEnd || chatInputText.value.length
    chatInputText.value = chatInputText.value.slice(0, start) + emoji + chatInputText.value.slice(end)
    nextTick(() => {
      input.focus()
      const pos = start + emoji.length
      input.setSelectionRange(pos, pos)
    })
  } else {
    chatInputText.value += emoji
  }
  showEmojiPanel.value = false
}

function handleGMResult(data: { message: string; success: boolean }) {
  if (state.value) {
    state.value.log.push({
      type: 'chat' as any,
      message: `⚙️ [GM] ${data.message}`,
      timestamp: Date.now(),
      logSeq: takeClientDirectLogSeq(),
      visibility: 'private',
      playerId: player.value?.id,
    })
  }
}

// 监听GM指令结果（多人模式）
function registerGMResultListener() {
  // 先解绑同引用，再绑定，避免同一实例中重复注册
  socketClient.off('gmResult', handleGMResult)
  socketClient.on('gmResult', handleGMResult)
}
registerGMResultListener()

// 点击外部关闭表情面板
function handleGlobalClick() {
  showEmojiPanel.value = false
}

// 渲染日志消息（解析超链接 + 聊天消息样式）
// lineIndex：当前行在 logs 数组中的下标；用于点击时解析 refs（每条日志的 yokai_0 等键会重复，不能全局搜第一条）
/** 去掉日志里冗余的「(抓到N张)」等括注，避免旧文案或异常占位显示 undefined */
function stripLogDrawParentheticals(text: string): string {
  if (!text) return text
  return text.replace(/\s*[\(（]抓到[^)）]*[\)）]/g, '')
}

function renderLogMessage(log: any, lineIndex?: number): string {
  // 聊天消息使用专属样式
  if (log.type === 'chat' && log.chatData) {
    const name = escapeHtml(log.chatData.senderName)
    const content = escapeHtml(log.chatData.rawContent)
    return `💬 <span class="chat-sender">[${name}]</span> <span class="chat-content">${content}</span>`
  }
  // GM指令结果
  if (log.type === 'chat' && log.message?.startsWith('⚙️')) {
    return `<span class="gm-result">${escapeHtml(log.message)}</span>`
  }

  if (!log.refs || Object.keys(log.refs).length === 0) {
    return escapeHtml(stripLogDrawParentheticals(log.message))
  }
  
  // 解析 {type:name} 格式的占位符
  let html = escapeHtml(stripLogDrawParentheticals(log.message))
  const lineAttr =
    lineIndex != null && lineIndex >= 0 ? ` data-log-line="${lineIndex}"` : ''
  for (const [placeholder, ref] of Object.entries(log.refs as Record<string, any>)) {
    const pattern = `{${placeholder}}`
    const escapedPattern = escapeHtml(pattern)
    const link = `<span class="log-link" data-ref-key="${escapeHtml(placeholder)}"${lineAttr}>${escapeHtml(ref.name)}</span>`
    html = html.split(escapedPattern).join(link)
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

  const lineStr = target.dataset.logLine
  if (lineStr !== undefined && lineStr !== '') {
    const idx = Number(lineStr)
    const log = logs.value[idx]
    const ref = log?.refs?.[refKey]
    if (ref) {
      showLogRefPopup(event, ref)
      return
    }
  }

  // 兼容无 data-log-line 的旧 DOM
  for (const log of logs.value) {
    if (log.refs && log.refs[refKey]) {
      showLogRefPopup(event, log.refs[refKey])
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

// 获取日志引用卡牌的图片路径（复用getCardImage的逻辑）
function getLogRefCardImage(ref: any): string {
  if (!ref) return ''
  
  // 使用id来计算图片路径，与getCardImage逻辑一致
  const rawId = ref.id
  if (!rawId) return ''
  
  const m = String(rawId).match(/^(\w+)_(\d+)$/)
  if (!m) {
    // 特殊处理阴阳术（id格式为 spell_基础术式 等）
    if (rawId.startsWith('spell_')) {
      const spellName = rawId.replace('spell_', '')
      if (spellName === '基础术式') return '/images/spells/601.webp'
      if (spellName === '中级符咒') return '/images/spells/602.webp'
      if (spellName === '高级符咒') return '/images/spells/603.webp'
    }
    return ''
  }
  
  const [, type, num] = m
  const n = parseInt(num)
  
  if (type === 'yokai')     return `/images/yokai/${201 + n}.webp`
  if (type === 'boss')      return `/images/bosses/${100 + n}.webp`
  if (type === 'shikigami') return `/images/shikigami/${400 + n}.webp`
  if (type === 'spell')     return `/images/spells/${600 + n}.webp`
  
  return ''
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
    } else if (b.type === 'SKILL_COST_REDUCTION') {
      buffs.push({ type: b.type, label: `🔥技能-${b.value}` })
    }
  }
  return buffs
})

// 涅槃之火技能减费效果计算（多张叠加）
const skillCostReduction = computed(() => {
  const tempBuffs = player.value?.tempBuffs || []
  return tempBuffs
    .filter((b: any) => b.type === 'SKILL_COST_REDUCTION')
    .reduce((sum: number, b: any) => sum + (b.value || 0), 0)
})

// 计算实际技能消耗（考虑涅槃之火减费）
function getActualSkillCost(baseCost: number): number {
  return Math.max(0, baseCost - skillCostReduction.value)
}

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
    tooltip.dynamicEffect = null
  } else if (cardType === 'yokai' || cardType === 'token') {
    tooltip.typeLabel = cardType === 'yokai' ? '御魂' : '令牌'
    tooltip.typeClass = cardType === 'yokai' ? 'type-yokai' : 'type-token'
    const f = state.value?.field
    const onField = !!(f?.yokaiSlots?.some(s => s && s.instanceId === card.instanceId))
    const curRaw = card.currentHp !== undefined ? card.currentHp : (card.hp ?? 0)
    const faceRaw = yokaiFaceOrPrintedHp(card)
    const cur = onField && f ? getNetCutterEffectiveHp(f, curRaw, 'yokai') : curRaw
    const face = onField && f ? getNetCutterEffectiveHp(f, faceRaw, 'yokai') : faceRaw
    const strikeHp = !!(onField && f && fieldHasNetCutter(f) && (cur !== curRaw || face !== faceRaw))
    let hpShown: string | number = face
    if (strikeHp) {
      const rawPair = `${curRaw}/${faceRaw}`
      const effPair = face > 0 && cur > 0 ? `${cur}/${face}` : cur <= 0 && face > 0 ? `0/${face}` : `${cur}/${face}`
      hpShown = `${rawPair} → ${effPair}`
    } else if (face > 0 && cur > 0 && cur < face) hpShown = `${cur}/${face}`
    else if (face > 0 && cur <= 0) hpShown = face
    const effMap = getCardEffectStats(card)
    tooltip.stats = { hp: { icon: '❤️', value: hpShown }, ...(effMap || {}) }
    tooltip.effect = card.effect || (cardType === 'token' ? '可用于超度' : '无特殊效果')
    tooltip.passive = null
    tooltip.skill = null
    
    const myPlayerForTip = state.value?.players.find(p => p.id === myPlayerId.value)
    // 三味：本回合已用阴阳术/鬼火牌 → 预计伤害
    if (card.name === '三味') {
      if (myPlayerForTip) {
        const played = myPlayerForTip.played || []
        let count = 0
        for (const c of played) {
          if (c.cardType === 'spell') {
            count++
          } else if (c.cardType === 'yokai') {
            const tags = (c as any).tags || []
            const subtype = (c as any).subtype || ''
            if (tags.includes('鬼火') || subtype.includes('鬼火')) {
              count++
            }
          }
        }
        const damage = count * 2
        if (count > 0) {
          tooltip.dynamicEffect = `🔥 当前已用 ${count} 张阴阳术/鬼火牌，预计伤害 +${damage}`
        } else {
          tooltip.dynamicEffect = `💡 打出前先使用阴阳术或鬼火牌可增加伤害`
        }
      } else {
        tooltip.dynamicEffect = null
      }
    } else if (card.name === '狂骨') {
      // 与 YokaiEffects 一致：打出瞬间读取当前鬼火为 X，再抓牌+1、伤害+X
      if (myPlayerForTip) {
        const gf = Math.max(0, Number(myPlayerForTip.ghostFire) || 0)
        const gfMax = Number(myPlayerForTip.maxGhostFire) > 0 ? Number(myPlayerForTip.maxGhostFire) : 5
        if (gf > 0) {
          tooltip.dynamicEffect = `⚔️ 当前鬼火 ${gf}/${gfMax}，打出时预计伤害 +${gf}，并抓牌+1（伤害先于抓牌锁定）`
        } else {
          tooltip.dynamicEffect = `💡 当前鬼火 0：打出时伤害 +0，仅抓牌+1；可先叠加鬼火再出狂骨`
        }
      } else {
        tooltip.dynamicEffect = null
      }
    } else {
      tooltip.dynamicEffect = null
    }
  } else if (cardType === 'penalty') {
    tooltip.typeLabel = '恶评'
    tooltip.typeClass = 'type-penalty'
    tooltip.stats = {
      charm: { icon: '👑', value: card.charm ?? -1 }
    }
    tooltip.effect = card.effect || '负面声誉'
    tooltip.passive = null
    tooltip.skill = null
    tooltip.dynamicEffect = null
  } else {
    tooltip.typeLabel = cardType || '卡牌'
    tooltip.typeClass = ''
    tooltip.stats = null
    tooltip.effect = card.effect || ''
    tooltip.passive = null
    tooltip.skill = null
    tooltip.dynamicEffect = null
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
  const fBt = state.value?.field
  const rawCurBt = state.value?.field.bossCurrentHp ?? boss.hp
  const rawMaxBt = boss.hp
  const btCur = fBt ? getNetCutterEffectiveHp(fBt, rawCurBt, 'boss') : rawCurBt
  const btMax = fBt ? getNetCutterEffectiveHp(fBt, rawMaxBt, 'boss') : rawMaxBt
  const showStrikeBt = !!(fBt && fieldHasNetCutter(fBt) && (btCur !== rawCurBt || btMax !== rawMaxBt))
  tooltip.stats = {
    hp: {
      icon: '❤️',
      value: showStrikeBt ? `${rawCurBt}/${rawMaxBt} → ${btCur}/${btMax}` : `${btCur}/${btMax}`,
    },
    charm: { icon: '👑', value: boss.charm || 0 }
  }
  tooltip.effect = boss.arrivalEffect || boss.effect || '击败后获得声誉'
  tooltip.passive = null
  tooltip.skill = null
  
  tooltip.show = true
}

// 任意弹窗打开时自动隐藏 tooltip
const anyModalOpen = computed(() =>
  hintModal.show || choiceModal.show || cardSelectModal.show ||
  salvageChoiceModal.show || targetModal.show || shikigamiModal.show ||
  spellSelectModal.show || zhenMuShouTargetModal.show
)

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
    // 移除强制滚动，由 watch(logs) 智能处理
  })
  
  // 绑定选择回调
  game.onChoiceRequired = async (options: string[]) => {
    return new Promise<number>((resolve) => {
      choiceModal.serverYokaiChoice = false
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
    choiceModal.serverYokaiChoice = false
  }
}

function toggleCardSelect(id: string) {
  const idx = cardSelectModal.selected.indexOf(id)
  if (idx >= 0) {
    cardSelectModal.selected.splice(idx, 1)
  } else {
    // 支持范围选择：使用 maxCount（如果设置了），否则使用 count
    const maxAllowed = cardSelectModal.maxCount > 0 ? cardSelectModal.maxCount : cardSelectModal.count
    if (cardSelectModal.selected.length < maxAllowed) {
      cardSelectModal.selected.push(id)
    }
  }
}

function resolveCardSelect() {
  // 支持范围选择：只要满足 minCount <= selected <= maxCount 即可确认
  const selected = cardSelectModal.selected.length
  const minOk = selected >= cardSelectModal.minCount
  const maxOk = selected <= cardSelectModal.maxCount
  if (cardSelectModal.resolve && minOk && maxOk) {
    cardSelectModal.resolve([...cardSelectModal.selected])
    cardSelectModal.show = false
    cardSelectModal.resolve = null
    cardSelectModal.isServerMultiSelect = false
    cardSelectModal.layoutVariant = ''
  }
}

// 超度选择处理（唐纸伞妖等御魂效果）
function handleSalvageChoice(doSalvage: boolean) {
  socketClient.send('game:salvageResponse', {
    playerId: myPlayerId.value,
    salvage: doSalvage
  })
  salvageChoiceModal.show = false
  salvageChoiceModal.card = null
}

// ===== 地藏像交互处理 =====

// 地藏像确认处理
function handleDizangConfirm(confirm: boolean) {
  socketClient.send('game:dizangConfirmResponse', { confirm })
  dizangConfirmModal.show = false
  dizangConfirmModal.card = null
}

// 地藏像式神选择处理
function handleDizangSelectShikigami(selectedIndex: number) {
  socketClient.send('game:dizangSelectShikigamiResponse', { selectedIndex })
  dizangSelectModal.show = false
  dizangSelectModal.candidates = []
}

// 地藏像式神置换处理
function handleDizangReplaceShikigami(replaceIndex: number | null) {
  socketClient.send('game:dizangReplaceShikigamiResponse', { replaceIndex })
  dizangReplaceModal.show = false
  dizangReplaceModal.newShikigami = null
  dizangReplaceModal.currentShikigami = []
}

// 妖怪目标选择处理（天邪鬼绿等御魂效果）
function handleYokaiTargetChoice(targetId: string) {
  console.log('[UI] handleYokaiTargetChoice emit targetId=', targetId)
  socketClient.send('game:yokaiTargetResponse', {
    targetId: targetId
  })
  yokaiTargetModal.show = false
  yokaiTargetModal.candidates = []
}

function handleZhenMuShouTargetChoice(targetId: string) {
  socketClient.send('game:zhenMuShouTargetResponse', { targetId })
  zhenMuShouTargetModal.show = false
  zhenMuShouTargetModal.candidates = []
}

// ===== 赤舌选择处理 =====
function startAkajitaCountdown(deadline: number) {
  if (akajitaCountdownTimer) {
    clearInterval(akajitaCountdownTimer)
  }
  akajitaCountdownTimer = window.setInterval(() => {
    const remaining = Math.ceil((deadline - Date.now()) / 1000)
    akajitaSelectModal.countdown = Math.max(0, remaining)
    if (remaining <= 0) {
      // 超时：默认选择基础术式（服务端也会处理，这里只是更新UI）
      closeAkajitaSelect()
    }
  }, 200)
}

function closeAkajitaSelect() {
  if (akajitaCountdownTimer) {
    clearInterval(akajitaCountdownTimer)
    akajitaCountdownTimer = null
  }
  akajitaSelectModal.show = false
  akajitaSelectModal.candidates = []
  akajitaSelectModal.countdown = 5
}

function handleAkajitaSelect(instanceId: string) {
  socketClient.send('game:akajitaSelectResponse', {
    selectedId: instanceId,
  })
  closeAkajitaSelect()
}

function showAkajitaDeckHint(cardName: string) {
  akajitaDeckHint.value = { cardName }
  // 3秒后自动隐藏
  if (akajitaDeckHintTimer) {
    clearTimeout(akajitaDeckHintTimer)
  }
  akajitaDeckHintTimer = window.setTimeout(() => {
    akajitaDeckHint.value = null
    akajitaDeckHintTimer = null
  }, 3000)
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

  if (!canPlay(c)) {
    console.log('[handleCardClick] 当前不可打出，忽略')
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
  
  // 已击杀的妖怪已自动退治，无需操作
  if (isKilled(y)) return

  if (player.value?.prohibitedTargets?.includes(y.instanceId)) return
  
  // 分配伤害（击杀时服务端/单人端会自动退治）
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'allocateDamage', slotIndex: i })
  } else {
    await game?.allocateDamage(i)
  }
}

function play(id: string) {
  if (!isMyTurn.value) return
  const c = player.value?.hand.find(x => x.instanceId === id)
  if (c && !canPlay(c)) return
  if (isMultiMode.value) {
    socketClient.sendAction({ type: 'playCard', cardInstanceId: id })
  } else {
    game?.playCard(id)
  }
}

async function kill(i: number) {
  if (!isMyTurn.value) return
  const y = state.value?.field.yokaiSlots[i]
  if (y && player.value?.prohibitedTargets?.includes(y.instanceId)) return
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

function yokaiInstanceOnField(y: CardInstance): boolean {
  return !!(state.value?.field?.yokaiSlots?.some(s => s && s.instanceId === y.instanceId))
}

/** 网切生效且「印刷/盘面 HP」与「有效 HP」不一致时，场上采用划线原值 + 绿色当前值 */
function yokaiHpShowNetCutterStrike(y: CardInstance): boolean {
  if (!yokaiInstanceOnField(y)) return false
  const f = state.value?.field
  if (!f || !fieldHasNetCutter(f)) return false
  return (
    displayYokaiCurrentHp(y) !== getYokaiCurrentHp(y) ||
    displayYokaiMaxHp(y) !== getYokaiMaxHp(y)
  )
}

/** 游荡区妖怪卡面展示用 HP（仅场上实例受 field 上网切等影响，与结算一致） */
function displayYokaiCurrentHp(y: CardInstance): number {
  const f = state.value?.field
  const raw = getYokaiCurrentHp(y)
  if (!f || !yokaiInstanceOnField(y)) return raw
  return getNetCutterEffectiveHp(f, raw, 'yokai')
}
function displayYokaiMaxHp(y: CardInstance): number {
  const f = state.value?.field
  const raw = getYokaiMaxHp(y)
  if (!f || !yokaiInstanceOnField(y)) return raw
  return getNetCutterEffectiveHp(f, raw, 'yokai')
}

function yokaiRemainingNeededToDefeat(y: CardInstance): number {
  const f = state.value?.field
  const rawCur = getYokaiCurrentHp(y)
  const rawMax = getYokaiMaxHp(y)
  if (rawCur <= 0) return 0
  if (!f || !yokaiInstanceOnField(y)) return rawCur
  const effectiveMax = getNetCutterEffectiveHp(f, rawMax, 'yokai')
  const damageAlready = rawMax - rawCur
  return Math.max(0, effectiveMax - damageAlready)
}
function isKilled(y: CardInstance): boolean {
  // 服务端使用hp字段，客户端可能用currentHp
  const hp = y.currentHp !== undefined ? y.currentHp : (y.hp || 0)
  return hp <= 0
}
function isWounded(y: CardInstance): boolean {
  const currentHp = displayYokaiCurrentHp(y)
  const maxHp = displayYokaiMaxHp(y)
  return currentHp < maxHp && currentHp > 0
}
function canKillYokai(y: CardInstance): boolean {
  if (player.value?.prohibitedTargets?.includes(y.instanceId)) return false
  const need = yokaiRemainingNeededToDefeat(y)
  return need > 0 && (player.value?.damage || 0) >= need
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
const isBossDefeated = computed(() => {
  // 多人模式：检查 pendingBossDeath 标记
  if (isMultiMode.value) {
    return (state.value as any)?.pendingBossDeath === true
  }
  // 单人模式：检查 bossCurrentHp <= 0
  return state.value?.field.currentBoss && (state.value?.field.bossCurrentHp ?? 999) <= 0
})
// 鬼王是否可以被攻击
const canAttackBoss = computed(() => {
  const p = player.value
  const b = state.value?.field.currentBoss
  return state.value?.turnPhase === 'action'
    && !!b
    && (p?.damage ?? 0) > 0
    && !isBossDefeated.value // 鬼王已被击败时不可再攻击
    && !(p?.prohibitedTargets?.includes(b.id))
})

async function hitBoss() {
  if (!isMyTurn.value) return // 多人模式：只有自己回合才能操作
  
  // 鬼王被击败后已自动退治，无需额外操作
  if (isBossDefeated.value) return

  const b = state.value?.field.currentBoss
  if (b && player.value?.prohibitedTargets?.includes(b.id)) return
  
  // 正常攻击鬼王
  if (!canAttackBoss.value) return
  
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

/** 妖怪卡面/印刷生命：击杀后退入弃牌堆等场景 hp 常为 0，界面与判定统一用 maxHp ?? hp */
function yokaiFaceOrPrintedHp(c: { hp?: number; maxHp?: number }): number {
  const m = c.maxHp;
  if (m != null && m > 0) return m;
  const h = c.hp;
  if (h != null && h > 0) return h;
  return 0;
}
function discardPileYokaiLife(c: { hp?: number; maxHp?: number }): number {
  return yokaiFaceOrPrintedHp(c)
}

// 中级符咒条件：手牌有基础术式 + 弃牌堆有生命≥2的妖怪 + 本回合未获得过
const canGetMediumSpell = computed(() => {
  const p = player.value
  if (!p) return false
  
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value || state.value?.turnPhase !== 'action') return false
    if ((p as any).hasGainedMediumSpell) return false
    const hasBasicSpell = (p.hand || []).some(c => c.cardId === 'spell_001' || c.cardId === 'basic_spell' || c.name === '基础术式')
    const hasYokaiHp2 = (p.discard || []).some(
      c => (c.cardType === 'yokai' || c.cardType === 'token') && discardPileYokaiLife(c) >= 2
    )
    return hasBasicSpell && hasYokaiHp2
  }
  
  // 单人模式
  if (!game) return false
  if (!game.canExchangeMediumSpell()) return false  // 本回合已获得过
  const hasBasicSpell = p.hand.some(c => c.cardId === 'spell_001' || c.name === '基础术式')
  const hasYokaiHp2 = p.discard.some(
    c => (c.cardType === 'yokai' || c.cardType === 'token') && discardPileYokaiLife(c) >= 2
  )
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
    const hasYokaiHp4 = (p.discard || []).some(
      c => (c.cardType === 'yokai' || c.cardType === 'token') && discardPileYokaiLife(c) >= 4
    )
    return hasMediumSpell && hasYokaiHp4
  }
  
  // 单人模式
  if (!game) return false
  if (!game.canExchangeAdvancedSpell()) return false  // 本回合已获得过
  const hasMediumSpell = p.hand.some(c => c.cardId === 'spell_002' || c.name === '中级符咒')
  const hasYokaiHp4 = p.discard.some(
    c => (c.cardType === 'yokai' || c.cardType === 'token') && discardPileYokaiLife(c) >= 4
  )
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
    .filter(
      c => (c.cardType === 'yokai' || c.cardType === 'token') && discardPileYokaiLife(c) >= requiredHp
    )
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
  cardSelectModal.layoutVariant = ''
}

function cancelCardSelect() {
  // 如果是允许跳过的服务端多选（如魅妖无可用牌），发送空选择
  if ((cardSelectModal as any).allowCancel && cardSelectModal.isServerMultiSelect && cardSelectModal.resolve) {
    cardSelectModal.resolve([])
    cardSelectModal.show = false
    cardSelectModal.isServerMultiSelect = false
    cardSelectModal.layoutVariant = ''
    ;(cardSelectModal as any).allowCancel = false
    cardSelectModal.selected = []
    cardSelectModal.resolve = null
    return
  }
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

/** 多人：天邪鬼绿需场上存在生命∈(0,4] 的游荡妖怪（与服务器 validateYokaiMustHaveTarget 一致） */
function hasMultiModeTenjoGreenTargets(): boolean {
  const slots = state.value?.field?.yokaiSlots
  if (!slots) return false
  return slots.some(
    (y): y is CardInstance => y !== null && (y.hp || 0) <= 4 && (y.hp || 0) > 0
  )
}

// 检查卡牌是否可以打出
function canPlay(c: CardInstance): boolean {
  // 多人模式
  if (isMultiMode.value) {
    if (!isMyTurn.value) return false
    if (state.value?.turnPhase !== 'action') return false
    const p = player.value
    if (!p) return false
    // 与单人 canPlayCard 一致：令牌/恶评/式神不能从手牌打出（否则 UI 会误判为可打）
    if (c.cardType === 'token' || c.name === '招福达摩') return false
    if (c.cardType === 'penalty') return false
    if (c.cardType === 'shikigami') return false
    // 检查鬼火是否足够
    const cost = c.cost || 0
    if (p.ghostFire < cost) return false
    // 单目标御魂：无合法目标不可打出（与天邪鬼绿规则一致）
    if (c.cardType === 'yokai' && (c.cardId === 'yokai_003' || c.name === '天邪鬼绿')) {
      if (!hasMultiModeTenjoGreenTargets()) return false
    }
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  left:calc(var(--s) * 150);
  top:calc(var(--s) * 15);
  right:calc(var(--s) * 320);
  display:flex;
  justify-content:space-between;
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 3) solid #FFD700;
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
  display:flex;flex-direction:column;gap:calc(var(--s) * 0);
}
.mini-stat{
  width:calc(var(--s) * 85);
  height:calc(var(--s) * 60);
  background:#151525;
  border:calc(var(--s) * 1) solid #D4A574;
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
  border-radius:calc(var(--s) * 2);
  border:calc(var(--s) * 1) solid rgba(255,255,255,.5);
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
  border:calc(var(--s) * 1) solid #D4A574;
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
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;
  padding:calc(var(--s) * 20);
}
.boss-card{
  background:linear-gradient(160deg,#3a0a0a,#1a0520);
  border:calc(var(--s) * 2) solid #D4A574;
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
  color:#777;font-size:calc(var(--s) * 9);
  background:rgba(0,0,0,.3);
  padding:calc(var(--s) * 2) calc(var(--s) * 8);border-radius:calc(var(--s) * 10);
  border:calc(var(--s) * 1) solid rgba(255,255,255,.08);
}

/* 游荡妖怪区 - left:600px, width:750px */
.yokai-panel{
  position:absolute;
  left:calc(var(--s) * 600);
  top:0;
  width:calc(var(--s) * 750);
  height:calc(var(--s) * 650);
  background:#151525;
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 15);
  overflow:hidden;
}
.yokai-panel-header-row{
  display:flex;
  flex-direction:row;
  align-items:center;
  gap:calc(var(--s) * 10);
  margin-bottom:calc(var(--s) * 8);
  min-width:0;
}
.yokai-panel-header-row .yokai-panel-title{
  margin-bottom:0;
  flex-shrink:0;
  text-align:left;
  white-space:nowrap;
}
.yokai-panel-header-row .turn-countdown-bar{
  margin-bottom:0;
  flex:1 1 0;
  min-width:0;
}
.turn-countdown-bar{
  position: relative;
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:center;
  gap:calc(var(--s) * 6);
  margin-bottom:calc(var(--s) * 8);
  padding:calc(var(--s) * 6) calc(var(--s) * 10);
  background:rgba(255, 110, 110, 0.16);
  border:calc(var(--s) * 1) solid rgba(255, 130, 130, 0.35);
  border-radius:calc(var(--s) * 8);
  overflow:hidden;
}
.turn-countdown-bar .off-turn-wait-hint{
  flex-basis:100%;
  text-align:center;
  font-size:calc(var(--s) * 12);
  color:rgba(255, 230, 200, 0.95);
  line-height:1.35;
  margin:0;
  padding-top:calc(var(--s) * 2);
}
.turn-countdown-bar .countdown-icon{
  font-size:calc(var(--s) * 18);
}
.turn-countdown-bar .countdown-text{
  font-size:calc(var(--s) * 16);
  color:#ffc1c1;
}
/* 自己回合时倒计时显示浅绿色 */
.turn-countdown-bar.my-turn{
  background:rgba(110, 255, 150, 0.16);
  border-color:rgba(130, 255, 170, 0.35);
}
.turn-countdown-bar.my-turn .countdown-text{
  color:#a8ffb8;
}
.turn-countdown-bar.my-turn .countdown-progress{
  background:linear-gradient(90deg, rgba(110, 255, 150, 0.5), rgba(80, 220, 120, 0.3));
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
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  overflow:hidden;
}
.info-box{
  flex:1;
  background:#1A1A2E;
  border:calc(var(--s) * 1) solid #D4A574;
  padding:calc(var(--s) * 10);
  overflow-y:auto;
  overflow-x:hidden;
  display:flex;flex-direction:column;gap:calc(var(--s) * 6);
  scroll-behavior:smooth;
}
/* 自定义滚动条样式 - 参考3.4节规范 */
.info-box::-webkit-scrollbar{
  width:calc(var(--s) * 6);
}
.info-box::-webkit-scrollbar-track{
  background:#1A1A2E;
  border-radius:calc(var(--s) * 3);
}
.info-box::-webkit-scrollbar-thumb{
  background:#D4A574;
  border-radius:calc(var(--s) * 3);
}
.info-box::-webkit-scrollbar-thumb:hover{
  background:#E5B685;
}
/* 信息区包装器 - 用于定位新消息按钮 */
.info-box-wrapper{
  flex:1;
  position:relative;
  display:flex;
  flex-direction:column;
  min-height:0;
}
/* 新消息提示按钮 */
.new-message-btn{
  position:absolute;
  bottom:calc(var(--s) * 10);
  left:50%;
  transform:translateX(-50%);
  background:linear-gradient(135deg, #D4A574 0%, #B8956A 100%);
  color:#1A1A2E;
  border:none;
  border-radius:calc(var(--s) * 16);
  padding:calc(var(--s) * 8) calc(var(--s) * 20);
  font-size:calc(var(--s) * 16);
  font-weight:bold;
  cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
  animation:bounce 0.6s ease infinite;
  z-index:10;
}
.new-message-btn:hover{
  background:linear-gradient(135deg, #E5B685 0%, #C9A67B 100%);
}
@keyframes bounce{
  0%,100%{transform:translateX(-50%) translateY(0);}
  50%{transform:translateX(-50%) translateY(-4px);}
}
.info-line{
  background:#2D1F3D;
  border:calc(var(--s) * 1) solid #D4A574;
  padding:calc(var(--s) * 8) calc(var(--s) * 12);
  font-size:calc(var(--s) * 20);
  color:#fff;
  min-height:calc(var(--s) * 48);
  /* 勿用 flex：v-html 内联文本与 .log-link 会变成多个 flex 子项，导致词条被拆行、出现大空隙（木魅等多词条日志） */
  display:block;
  overflow-wrap: break-word;
  word-break: normal;
  line-height:1.4;
  flex-shrink:0;
}
/* 日志超链接样式（使用:deep()穿透scoped限制，应用到v-html内容） */
.info-line :deep(.log-link){
  color:#4FC3F7;
  cursor:pointer;
  text-decoration:underline;
  transition:all 0.15s;
}
.info-line :deep(.log-link:hover){
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
  border:calc(var(--s) * 2) solid #D4A574;
  border-radius:calc(var(--s) * 8);
  overflow:hidden;
  width:140px;
  box-shadow:0 4px 20px rgba(0,0,0,0.5);
}
.log-ref-popup.boss-popup{
  width:196px;
}
/* 卡牌图片区（手牌比例 140x196） */
.ref-card-image-area{
  position:relative;
  width:140px;
  height:196px;
  overflow:hidden;
  background:#1A1A2E;
}
/* 鬼王横版（196x140） */
.ref-card-image-area.boss-image-area{
  width:196px;
  height:140px;
}
.ref-card-img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.ref-card-name-overlay{
  position:absolute;
  bottom:24px;left:8px;
  color:#fff;
  font-size:14px;
  font-weight:bold;
  text-shadow:0 1px 3px rgba(0,0,0,0.8);
}
.ref-card-stats-overlay{
  position:absolute;
  bottom:6px;left:8px;
  color:#fff;
  font-size:12px;
  text-shadow:0 1px 3px rgba(0,0,0,0.8);
}
/* 效果描述区 */
.ref-card-effect-area{
  padding:10px;
  background:linear-gradient(180deg, #1E1E3F 0%, #16162B 100%);
  border-top:1px solid #D4A574;
}
.ref-effect-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:8px;
}
.ref-card-title{
  color:#fff;
  font-size:14px;
  font-weight:bold;
}
.ref-card-tag{
  background:#5C4A8A;
  color:#fff;
  font-size:10px;
  padding:2px 6px;
  border-radius:3px;
}
.ref-card-tag.shikigami-tag{
  background:#8B4513;
}
.ref-card-tag.boss-tag{
  background:#8B0000;
}
.ref-effect-cost{
  display:flex;
  align-items:center;
  gap:4px;
  margin-bottom:6px;
  color:#FFD700;
  font-size:12px;
}
.ref-effect-desc{
  color:#ccc;
  font-size:12px;
  line-height:1.5;
}
/* 玩家区 */
.ref-player-area{
  padding:12px;
  display:flex;
  align-items:center;
  gap:8px;
}
.ref-player-icon{
  font-size:24px;
}
.ref-player-name{
  color:#fff;
  font-size:14px;
}
.log-ref-default{
  padding:12px;
  color:#fff;
  font-size:14px;
}
/* ── 聊天输入栏 ── */
.chat-input-bar{
  display:flex;
  align-items:center;
  gap:calc(var(--s) * 8);
  padding:calc(var(--s) * 4) calc(var(--s) * 8);
  background:#1A1A2E;
  border:calc(var(--s) * 1) solid #D4A574;
  border-radius:calc(var(--s) * 4);
  position:relative;
  flex-shrink:0;
}
.chat-emoji-btn{
  width:calc(var(--s) * 32);
  height:calc(var(--s) * 32);
  background:transparent;
  border:calc(var(--s) * 1) solid #D4A574;
  border-radius:calc(var(--s) * 4);
  color:#FFD700;
  cursor:pointer;
  font-size:calc(var(--s) * 18);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
  padding:0;
}
.chat-emoji-btn:hover{background:#2D1F3D}
.chat-input{
  flex:1;
  height:calc(var(--s) * 32);
  min-width:0;
  background:#151525;
  border:calc(var(--s) * 1) solid #3A3A5A;
  border-radius:calc(var(--s) * 4);
  color:#fff;
  font-size:calc(var(--s) * 14);
  padding:0 calc(var(--s) * 8);
  outline:none;
  box-sizing:border-box;
}
.chat-input::placeholder{color:#666680}
.chat-input:focus{border-color:#D4A574}
.chat-send-btn{
  width:calc(var(--s) * 56);
  height:calc(var(--s) * 32);
  background:#D4A574;
  border:none;
  border-radius:calc(var(--s) * 4);
  color:#1A1A2E;
  font-size:calc(var(--s) * 14);
  font-weight:bold;
  cursor:pointer;
  flex-shrink:0;
  padding:0;
}
.chat-send-btn:hover:not(:disabled){background:#E8B885}
.chat-send-btn:disabled{background:#5A5A6A;color:#8A8A9A;cursor:not-allowed}
/* 表情面板 */
.emoji-panel{
  position:absolute;
  bottom:calc(100% + calc(var(--s) * 6));
  left:0;
  width:calc(var(--s) * 300);
  max-height:calc(var(--s) * 240);
  background:#1A1A2E;
  border:calc(var(--s) * 1) solid #D4A574;
  border-radius:calc(var(--s) * 8);
  padding:calc(var(--s) * 10);
  display:grid;
  grid-template-columns:repeat(8,1fr);
  gap:calc(var(--s) * 4);
  overflow-y:auto;
  z-index:100;
}
.emoji-item{
  width:calc(var(--s) * 32);
  height:calc(var(--s) * 32);
  display:flex;align-items:center;justify-content:center;
  font-size:calc(var(--s) * 20);
  cursor:pointer;
  border-radius:calc(var(--s) * 4);
  user-select:none;
}
.emoji-item:hover{background:#2D1F3D}

/* 聊天消息样式区分 */
.info-line.chat-line{
  background:#2A1F35;
}
.info-line :deep(.chat-sender){
  color:#FFD700;
  font-weight:bold;
}
.info-line :deep(.chat-content){
  color:#E0E0E0;
}
.info-line :deep(.gm-result){
  color:#90CAF9;
  font-style:italic;
}

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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;
  padding:calc(var(--s) * 10);
  gap:calc(var(--s) * 10);
}
.avatar-box{
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 120);
  border:calc(var(--s) * 1) solid #D4A574;
  background:#1A1A2E;
}
.stat-box{
  flex:1;
  display:flex;flex-direction:column;gap:calc(var(--s) * 5);
}
.stat-item{
  background:#151525;
  border:calc(var(--s) * 1) solid #D4A574;
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 1) solid #D4A574;
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
  border:calc(var(--s) * 1) solid rgba(233,30,99,.5);
  z-index:2;
}
/* 镇墓兽禁止目标：全场可见盾标（不拦截点击，避免误挡分配伤害） */
.zhenmu-shield-badge{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:3;
  font-size:calc(var(--s) * 44);
  line-height:1;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,.85));
  pointer-events:none;
  user-select:none;
}
.zhenmu-shield-badge--boss{
  font-size:42px;
}
.yokai-card.zhenmuBlockedMe:not(.empty):not(.killed){
  opacity:.88;
  cursor:not-allowed;
}
.boss-card.zhenmuBlockedMe:not(.boss-defeated){
  opacity:.88;
  cursor:not-allowed;
}
@keyframes canKillPulse{
  0%,100%{box-shadow:0 0 6px rgba(76,175,80,.4)}
  50%{box-shadow:0 0 16px rgba(76,175,80,.9)}
}

.action-bar{
  display:flex;gap:calc(var(--s) * 5);align-items:center;
  padding-top:calc(var(--s) * 5);
  border-top:calc(var(--s) * 1) solid rgba(255,255,255,.08);
  margin-top:auto;flex-shrink:0;
}
.deck-num,.exile-num{
  background:rgba(0,0,0,.4);
  border:calc(var(--s) * 1) solid rgba(255,255,255,.1);
  padding:calc(var(--s) * 4) calc(var(--s) * 8);border-radius:calc(var(--s) * 4);font-size:calc(var(--s) * 10);
  color:#aaa;min-width:28px;text-align:center;
}
.act-btn{
  flex:1;padding:calc(var(--s) * 5);
  background:rgba(80,120,200,.2);
  border:calc(var(--s) * 1) solid rgba(80,120,200,.4);
  border-radius:calc(var(--s) * 5);color:#b0c4de;
  cursor:pointer;font-size:calc(var(--s) * 10);
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
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  align-items:center;
}
.shiki-cards{
  display:flex;
  gap:calc(var(--s) * 10);
  padding:calc(var(--s) * 10);
}
/* 鬼火槽 + buff图标的容器 */
.ghost-fire-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--s) * 12);
  margin-top: auto;
  padding-bottom: calc(var(--s) * 10);
}
.ghost-fire-bar{
  display:flex;
  gap:calc(var(--s) * 5);
}
.fire-slot{
  width:calc(var(--s) * 40);
  height:calc(var(--s) * 40);
  background:#333;
  border-radius:50%;
  border:calc(var(--s) * 1) solid #D4A574;
}
.fire-slot.active{
  background:linear-gradient(135deg,#ff6b35,#f7931e);
  box-shadow:0 0 calc(var(--s) * 10) rgba(255,107,53,.6);
}
.shiki-card{
  width:calc(var(--s) * 135);
  height:calc(var(--s) * 192);
  background:#1A1A2E;
  border:calc(var(--s) * 1) solid #D4A574;
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

/* 涅槃之火减费显示样式；场上 HP 网切复用 cost-original / cost-reduced */
.skill-cost-display {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--s) * 2);
}
.field-hp-wrap {
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
}
.cost-original {
  text-decoration: line-through;
  color: #888;
  opacity: 0.6;
}
.cost-reduced {
  color: #4CAF50;
  font-weight: bold;
  text-shadow: 0 0 calc(var(--s) * 4) rgba(76, 175, 80, 0.6);
  animation: cost-glow 1.5s ease-in-out infinite alternate;
}
@keyframes cost-glow {
  from { text-shadow: 0 0 calc(var(--s) * 4) rgba(76, 175, 80, 0.4); }
  to { text-shadow: 0 0 calc(var(--s) * 8) rgba(76, 175, 80, 0.8); }
}

/* 涅槃之火buff图标（与鬼火槽平行显示） */
.nirvana-buff-indicator {
  display: flex;
  align-items: center;
  gap: calc(var(--s) * 2);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.1));
  border: calc(var(--s) * 1) solid #4CAF50;
  border-radius: calc(var(--s) * 20);
  padding: calc(var(--s) * 6) calc(var(--s) * 12);
  animation: nirvana-pulse 2s ease-in-out infinite;
}
@keyframes nirvana-pulse {
  0%, 100% { box-shadow: 0 0 calc(var(--s) * 4) rgba(76, 175, 80, 0.3); }
  50% { box-shadow: 0 0 calc(var(--s) * 8) rgba(76, 175, 80, 0.6); }
}
.nirvana-icon {
  font-size: calc(var(--s) * 18);
  filter: drop-shadow(0 0 calc(var(--s) * 3) rgba(255, 107, 53, 0.6));
}
.nirvana-label {
  font-size: calc(var(--s) * 16);
  font-weight: bold;
  color: #4CAF50;
  text-shadow: 0 0 calc(var(--s) * 3) rgba(76, 175, 80, 0.5);
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
  border:calc(var(--s) * 1) solid #D4A574;
  border-radius:calc(var(--s) * 4);
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 1) solid #D4A574;
  display:flex;align-items:center;justify-content:center;gap:calc(var(--s) * 8);
  font-size:calc(var(--s) * 28);
}
.damage-display b{color:#fff;font-size:calc(var(--s) * 32)}

/* 打出区列表 - 在 damage-display 下方 */
.played-area{
  position:absolute;
  left:calc(var(--s) * 10);
  top:calc(var(--s) * 90);
  width:calc(var(--s) * 100);
  height:calc(var(--s) * 170);
  background:rgba(21,21,37,0.9);
  border:calc(var(--s) * 1) solid #D4A574;
  border-radius:calc(var(--s) * 4);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.played-list{
  flex:1;
  overflow-y:auto;
  overflow-x:hidden;
  padding:calc(var(--s) * 4);
}
.played-list::-webkit-scrollbar{width:calc(var(--s) * 3)}
.played-list::-webkit-scrollbar-track{background:transparent}
.played-list::-webkit-scrollbar-thumb{background:rgba(212,165,116,0.4);border-radius:calc(var(--s) * 2)}
.played-item{
  display:flex;
  align-items:center;
  gap:calc(var(--s) * 4);
  padding:calc(var(--s) * 3) calc(var(--s) * 4);
  border-radius:calc(var(--s) * 3);
  background:rgba(255,255,255,0.05);
  margin-bottom:calc(var(--s) * 3);
  cursor:pointer;
  transition:background 0.15s;
}
.played-item:hover{
  background:rgba(212,165,116,0.2);
}
.played-item:last-child{
  margin-bottom:0;
}
.played-thumb{
  width:calc(var(--s) * 24);
  height:calc(var(--s) * 32);
  border-radius:calc(var(--s) * 2);
  object-fit:cover;
  flex-shrink:0;
}
.played-name{
  font-size:calc(var(--s) * 11);
  color:#ddd;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.played-count{
  padding:calc(var(--s) * 4) calc(var(--s) * 6);
  font-size:calc(var(--s) * 10);
  color:#aaa;
  background:rgba(0,0,0,0.3);
  text-align:center;
  border-top:calc(var(--s) * 1) solid rgba(212,165,116,0.3);
}

.hand-cards{
  display:flex;
  gap:0;
  overflow-x:auto;
  flex:1;
  min-height:0; /* 避免 flex 子项撑出父级竖向滚动条 */
  align-items:center;  /* 改为垂直居中 */
  justify-content:center;
  padding:0 calc(var(--s) * 5);
}
.hand-cards::-webkit-scrollbar{height:calc(var(--s) * 3)}
.hand-cards::-webkit-scrollbar-track{background:transparent}
.hand-cards::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:calc(var(--s) * 2)}

/* 手牌：保持3:4比例，自适应叠加 */
.hand-card{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 200);
  border-radius:calc(var(--s) * 6);
  text-align:center;cursor:pointer;flex-shrink:0;
  transition:all .18s;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  isolation:isolate; /* 每张牌自成层叠上下文，避免与其他手牌的子层（底部遮罩）穿插 */
  border:calc(var(--s) * 1) solid #D4A574;
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
  z-index:1000 !important; /* 盖住所有兄弟手牌（含内联 zIndex） */
}
.hand-card.spell{background:linear-gradient(160deg,#0d2b5e,#1565C0)}
.hand-card.yokai{background:linear-gradient(160deg,#0a2a14,#1b5e20)}
.hand-card.token{background:linear-gradient(160deg,#3e2000,#e65100)}
.hand-card.penalty{background:linear-gradient(160deg,#1a1a2e,#37474f)}
.hand-card.boss{background:linear-gradient(160deg,#2a0030,#6a1b9a)}
/* 不可打出：整层灰蒙版（禁用感）+ 淡红细边 + 弱外光（10px），不用大卡 opacity、不过分发光以免撑布局 */
.hand-card.unplayable{
  cursor:not-allowed;
  opacity:1;
  filter:none;
  border-width:2px;
  border-color:#d89898;
  box-shadow:
    0 0 0 1px rgba(255, 210, 205, 0.65),
    0 0 10px 1px rgba(255, 120, 110, 0.28),
    0 calc(var(--s) * 2) calc(var(--s) * 8) rgba(0,0,0,.34);
}
.hand-card.unplayable::after{
  content:'';
  position:absolute;
  inset:0;
  border-radius:inherit;
  background:rgba(48, 52, 62, 0.58);
  pointer-events:none;
  z-index:1;
}
.hand-card.unplayable .card-art{
  filter:brightness(0.88) saturate(0.85);
}
.hand-card.unplayable .card-info{
  position:relative;
  z-index:2;
}
.hand-card.unplayable:hover{
  transform:none;
  border-color:#e0a8a8;
  box-shadow:
    0 0 0 1px rgba(255, 220, 215, 0.7),
    0 0 10px 2px rgba(255, 130, 115, 0.3),
    0 2px 10px rgba(0,0,0,.36);
}
.hand-card.unplayable:hover::after{
  background:rgba(42, 46, 56, 0.62);
}
.hand-card.selecting{border:calc(var(--s) * 2) solid #ff9800;box-shadow:0 0 calc(var(--s) * 10) rgba(255,152,0,.5)}

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
  border:calc(var(--s) * 2) solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--s) * 10);
}
.end-btn{
  width:calc(var(--s) * 221);
  height:calc(var(--s) * 198);
  background:#539D9D;
  border:calc(var(--s) * 2) solid #D4A574;
  border-radius:calc(var(--s) * 8);
  color:#fff;
  font-size:calc(var(--s) * 32);
  cursor:pointer;font-weight:bold;
  transition:all .18s;
}
.end-btn:hover:not(:disabled):not(.not-my-turn){
  background:#5DB5B5;
  box-shadow:0 0 calc(var(--s) * 20) rgba(83,157,157,.6);
}
.end-btn:disabled{opacity:.4;cursor:not-allowed}
/* 非我回合：暗红/灰色，与回合倒计时进度条一致 */
.end-btn.not-my-turn{
  background:linear-gradient(180deg, #4a3040 0%, #3a2535 100%);
  border-color:#6a4a5a;
  color:#998;
  cursor:default;
}
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
  border:calc(var(--s) * 2) solid #4a4a8a;
  border-radius:calc(var(--s) * 8);
  padding:calc(var(--s) * 12) calc(var(--s) * 15);
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

/* 超度选择弹窗（唐纸伞妖等御魂效果） */
.salvage-choice-modal{min-width:300px}
.modal-hint{font-size:12px;color:#aaa;margin-bottom:12px}
.salvage-card-preview{
  display:flex;gap:15px;
  background:rgba(0,0,0,.3);
  border-radius:8px;padding:12px;
  margin-bottom:15px;
}
.salvage-card-img{
  width:calc(var(--s) * 100);height:calc(var(--s) * 140);
  border-radius:calc(var(--s) * 6);object-fit:cover;
  border:calc(var(--s) * 2) solid #667eea;
  box-shadow:0 4px 15px rgba(102,126,234,.3);
}
.salvage-card-info{flex:1;display:flex;flex-direction:column;gap:6px}
.salvage-card-name{font-size:16px;font-weight:bold;color:#f0e6d3}
.salvage-card-stats{font-size:13px;color:#ddd}
.salvage-card-effect{font-size:11px;color:#bbb;line-height:1.4;overflow-y:auto;max-height:60px}
.salvage-choice-btns{display:flex;gap:10px;justify-content:center}
.salvage-choice-btns .btn{
  flex:1;padding:10px 16px;border:none;border-radius:6px;
  font-size:13px;cursor:pointer;transition:all .15s;
}
.salvage-choice-btns .btn.primary{
  background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;
}
.salvage-choice-btns .btn.primary:hover{transform:scale(1.02);box-shadow:0 3px 12px rgba(102,126,234,.4)}
.salvage-choice-btns .btn.secondary{
  background:rgba(100,100,100,.6);color:#ddd;
}
.salvage-choice-btns .btn.secondary:hover{background:rgba(120,120,120,.7)}

/* 地藏像确认弹窗 */
.dizang-confirm-modal{min-width:300px}
.dizang-card-preview{
  display:flex;gap:15px;
  background:rgba(0,0,0,.3);
  border-radius:8px;padding:12px;
  margin-bottom:15px;
}
.dizang-card-img{
  width:calc(var(--s) * 100);height:calc(var(--s) * 140);
  border-radius:calc(var(--s) * 6);object-fit:cover;
  border:calc(var(--s) * 2) solid #8B5CF6;
  box-shadow:0 4px 15px rgba(139,92,246,.3);
}
.dizang-card-info{flex:1;display:flex;flex-direction:column;gap:6px}
.dizang-card-name{font-size:16px;font-weight:bold;color:#f0e6d3}
.dizang-card-stats{font-size:13px;color:#ddd}
.dizang-card-effect{font-size:11px;color:#bbb;line-height:1.4}
.dizang-confirm-btns{display:flex;gap:10px;justify-content:center}
.dizang-confirm-btns .btn{
  flex:1;padding:10px 16px;border:none;border-radius:6px;
  font-size:13px;cursor:pointer;transition:all .15s;
}
.dizang-confirm-btns .btn.primary{
  background:linear-gradient(135deg,#8B5CF6,#A855F7);color:#fff;
}
.dizang-confirm-btns .btn.primary:hover{transform:scale(1.02);box-shadow:0 3px 12px rgba(139,92,246,.4)}
.dizang-confirm-btns .btn.secondary{
  background:rgba(100,100,100,.6);color:#ddd;
}
.dizang-confirm-btns .btn.secondary:hover{background:rgba(120,120,120,.7)}

/* 地藏像式神选择弹窗 */
.dizang-select-modal{min-width:400px}
.dizang-shikigami-grid{
  display:flex;flex-wrap:wrap;gap:20px;
  justify-content:center;padding:15px;
}
.dizang-shikigami-card{
  width:calc(var(--s) * 150);padding:calc(var(--s) * 12);
  background:rgba(0,0,0,.4);
  border:calc(var(--s) * 2) solid #4a4a6a;border-radius:calc(var(--s) * 10);
  cursor:pointer;transition:all .2s;
  text-align:center;
}
.dizang-shikigami-card:hover{
  border-color:#8B5CF6;transform:scale(1.05);
  box-shadow:0 4px 20px rgba(139,92,246,.3);
}
.dizang-shikigami-card.highlight{
  border-color:#22C55E;background:rgba(34,197,94,.1);
}
.shikigami-img{
  width:calc(var(--s) * 100);height:calc(var(--s) * 100);
  border-radius:calc(var(--s) * 8);object-fit:cover;
  margin-bottom:8px;
}
.shikigami-info{color:#f0e6d3}
.shikigami-name{font-size:14px;font-weight:bold;margin-bottom:4px}
.shikigami-skill{font-size:11px;color:#aaa}

/* 地藏像式神置换弹窗 */
.dizang-replace-modal{min-width:450px}
.dizang-new-shikigami{
  margin-bottom:20px;padding:15px;
  background:rgba(34,197,94,.1);border:1px solid #22C55E;
  border-radius:10px;
}
.new-shikigami-label,.current-shikigami-label{
  font-size:13px;color:#aaa;margin-bottom:10px;
}
.dizang-replace-btns{
  margin-top:15px;display:flex;justify-content:center;
}
.dizang-replace-btns .btn.secondary{
  padding:10px 24px;background:rgba(100,100,100,.6);
  color:#ddd;border:none;border-radius:6px;cursor:pointer;
}
.dizang-replace-btns .btn.secondary:hover{background:rgba(120,120,120,.7)}

/* 妖怪目标选择弹窗（天邪鬼绿等御魂效果） */
.yokai-target-modal{min-width:350px}
.yokai-target-grid{
  display:flex;flex-wrap:wrap;gap:15px;
  justify-content:center;padding:15px;
}
.yokai-target-card{
  width:calc(var(--s) * 120);padding:calc(var(--s) * 10);
  background:rgba(0,0,0,.4);
  border:calc(var(--s) * 2) solid #4a4a6a;border-radius:calc(var(--s) * 8);
  cursor:pointer;transition:all .2s;
  text-align:center;
}
.yokai-target-card:hover{
  border-color:#D4A574;transform:scale(1.05);
  box-shadow:0 4px 15px rgba(212,165,116,.4);
}
.yokai-target-img{
  width:100%;height:80px;object-fit:cover;
  border-radius:6px;margin-bottom:8px;
}
.yokai-target-info{display:flex;flex-direction:column;gap:4px}
.yokai-target-name{font-size:13px;font-weight:bold;color:#f0e6d3}
.yokai-target-stat{font-size:12px;color:#ff6b6b}

/* 卡牌选择弹窗 */
.card-select-modal{min-width:320px}
.card-select-grid{display:flex;flex-wrap:wrap;gap:15px;justify-content:center;max-height:300px;overflow-y:auto;padding:15px}
.card-select-grid.mei-yao-select-grid{
  max-height:min(70vh,560px);
  justify-content:flex-start;
  gap:10px 12px;
  align-content:flex-start;
}
.select-card-slot{display:contents}
.select-card-slot.mei-yao-slot{display:flex;flex-direction:column;align-items:center;gap:6px;width:calc(var(--s) * 108);flex:0 0 auto}
.select-card-item.mei-yao-card{
  width:calc(var(--s) * 100)!important;height:calc(var(--s) * 140)!important;
}
.select-card-item.empty-deck-slot{border-style:dashed;border-color:#666;background:linear-gradient(160deg,#252540,#1a1a30)}
.card-empty-deck-placeholder{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  padding:8px;text-align:center;background:rgba(0,0,0,.35);z-index:2;
}
.empty-deck-icon{font-size:calc(var(--s) * 28);opacity:.85}
.empty-deck-text{font-size:11px;color:#b8b8c8;line-height:1.3}
.select-card-owner-below{
  display:flex;flex-direction:column;align-items:center;gap:2px;max-width:100%;
  font-size:11px;color:#d4c4a8;text-align:center;line-height:1.25;
}
.owner-below-name{font-weight:600;color:#f0e6d3}
.owner-below-id{font-size:10px;color:#8a9aab;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.owner-below-order{opacity:.85;font-size:10px;color:#a89f8c}
.select-card-item{
  width:calc(var(--s) * 120);height:calc(var(--s) * 168);
  border-radius:calc(var(--s) * 6);overflow:hidden;
  position:relative;
  display:flex;flex-direction:column;justify-content:flex-end;
  border:calc(var(--s) * 3) solid #555;
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

/* 不可用卡牌样式（令牌/恶评） */
.select-card-item.unusable{
  opacity:0.5;
  filter:grayscale(60%);
  cursor:not-allowed;
  border-color:#555;
}
.select-card-item.unusable:hover{
  transform:none;
  border-color:#555;
}
.unusable-badge{
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  background:rgba(0,0,0,0.7);
  color:#ff6b6b;
  padding:4px 10px;
  border-radius:4px;
  font-size:12px;
  font-weight:bold;
  z-index:3;
}
.owner-tag{
  display:block;
  font-size:10px;
  color:#9370DB;
  font-weight:normal;
  margin-top:2px;
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
  border:calc(var(--s) * 2) solid #D4A574;
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
  border:calc(var(--s) * 3) solid #D4A574;
  border-radius:calc(var(--s) * 12);
  padding:calc(var(--s) * 25) calc(var(--s) * 30);
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
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 168);
  border-radius:calc(var(--s) * 6);
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  border:calc(var(--s) * 2) solid #666;
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
/* 牌库禁止点击 - 玩家无法知道牌库顺序 */
.pile-box.deck-no-click{cursor:not-allowed;opacity:0.85}
.pile-box.deck-no-click:hover{background:inherit;border-color:#D4A574}

/* 牌库有展示卡牌时的样式 */
.pile-box.deck-has-revealed{cursor:pointer;border-color:#9370DB;position:relative}
.pile-box.deck-has-revealed:hover{background:#2D1F3D;border-color:#FFD700}
.deck-revealed-badge{
  position:absolute;
  top:-6px;
  right:-6px;
  background:#9370DB;
  color:#fff;
  font-size:11px;
  padding:2px 5px;
  border-radius:8px;
  box-shadow:0 2px 4px rgba(0,0,0,0.3);
}

/* 已展示卡牌弹窗样式 */
.revealed-deck-panel .pile-card-item.revealed-card{position:relative}
.revealed-card .revealed-badge{
  position:absolute;
  top:4px;
  right:4px;
  font-size:12px;
  background:rgba(147,112,219,0.8);
  padding:2px 4px;
  border-radius:4px;
}
.unknown-cards-hint{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  margin:15px 0;
  padding:12px;
  background:rgba(255,255,255,0.05);
  border-radius:8px;
  color:#888;
  font-size:14px;
}
.card-back-icon{font-size:24px;opacity:0.6}

/* 魅妖查看提示样式 */
.meiyao-viewing-alert{
  position:absolute;
  top:-40px;
  left:50%;
  transform:translateX(-50%);
  background:linear-gradient(135deg, #9370DB 0%, #663399 100%);
  color:#fff;
  padding:6px 12px;
  border-radius:12px;
  font-size:12px;
  white-space:nowrap;
  display:flex;
  align-items:center;
  gap:6px;
  box-shadow:0 4px 12px rgba(147,112,219,0.5);
  animation:meiyao-pulse 1.5s ease-in-out infinite;
  z-index:100;
}
.meiyao-icon{font-size:16px}
@keyframes meiyao-pulse{
  0%,100%{box-shadow:0 4px 12px rgba(147,112,219,0.5)}
  50%{box-shadow:0 4px 20px rgba(147,112,219,0.8)}
}

/* 赤舌选择弹窗样式 */
.akajita-select-modal{
  min-width:320px;
  max-width:400px;
  text-align:center;
}
.akajita-countdown{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  margin:15px 0;
}
.akajita-countdown .countdown-icon{font-size:18px}
.akajita-countdown .countdown-text{
  font-size:20px;
  font-weight:bold;
  color:#ff6b6b;
  min-width:36px;
}
.akajita-countdown .countdown-bar{
  flex:1;
  max-width:150px;
  height:8px;
  background:rgba(255,255,255,0.1);
  border-radius:4px;
  overflow:hidden;
}
.akajita-countdown .countdown-progress{
  height:100%;
  background:linear-gradient(90deg, #ff6b6b 0%, #ffa500 100%);
  border-radius:4px;
  transition:width 0.2s linear;
}
.akajita-options{
  display:flex;
  gap:15px;
  justify-content:center;
  margin:20px 0;
}
.akajita-option-btn{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
  padding:15px 25px;
  border:2px solid #666;
  border-radius:12px;
  background:rgba(0,0,0,0.3);
  color:#fff;
  cursor:pointer;
  transition:all 0.2s ease;
  min-width:120px;
}
.akajita-option-btn:hover{
  transform:scale(1.05);
}
.akajita-option-btn.spell-btn{
  border-color:#4a90d9;
  background:linear-gradient(135deg, rgba(74,144,217,0.2) 0%, rgba(74,144,217,0.1) 100%);
}
.akajita-option-btn.spell-btn:hover{
  border-color:#6ab0f9;
  box-shadow:0 0 15px rgba(74,144,217,0.5);
}
.akajita-option-btn.token-btn{
  border-color:#d4a574;
  background:linear-gradient(135deg, rgba(212,165,116,0.2) 0%, rgba(212,165,116,0.1) 100%);
}
.akajita-option-btn.token-btn:hover{
  border-color:#f4c594;
  box-shadow:0 0 15px rgba(212,165,116,0.5);
}
.akajita-option-btn .opt-icon{font-size:28px}
.akajita-option-btn .opt-name{font-size:14px;font-weight:bold}
.akajita-card-pick{
  flex-wrap:wrap;
  gap:12px;
}
.akajita-card-btn{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;
  padding:10px;
  border:2px solid #666;
  border-radius:12px;
  background:rgba(0,0,0,0.35);
  cursor:pointer;
  transition:all 0.2s ease;
  min-width:100px;
}
.akajita-card-btn:hover{
  transform:scale(1.03);
  border-color:#ff8c42;
  box-shadow:0 0 12px rgba(255,140,66,0.35);
}
.akajita-card-btn img{
  width:72px;
  height:auto;
  border-radius:6px;
  display:block;
}
.akajita-card-btn .opt-name{font-size:13px;font-weight:bold;color:#fff}
.akajita-timeout-hint{
  font-size:12px;
  color:#888;
  margin-top:10px;
}

/* 赤舌牌库提示浮窗 */
.akajita-deck-hint{
  position:fixed;
  top:50%;
  left:50%;
  transform:translate(-50%, -50%);
  background:linear-gradient(135deg, #8B4513 0%, #654321 100%);
  color:#fff;
  padding:15px 25px;
  border-radius:12px;
  font-size:16px;
  display:flex;
  align-items:center;
  gap:10px;
  box-shadow:0 8px 25px rgba(139,69,19,0.6);
  animation:akajita-hint-appear 0.3s ease-out, akajita-hint-pulse 2s ease-in-out infinite 0.3s;
  z-index:9999;
}
.akajita-deck-hint .hint-icon{font-size:24px}
@keyframes akajita-hint-appear{
  0%{opacity:0;transform:translate(-50%,-50%) scale(0.8)}
  100%{opacity:1;transform:translate(-50%,-50%) scale(1)}
}
@keyframes akajita-hint-pulse{
  0%,100%{box-shadow:0 8px 25px rgba(139,69,19,0.6)}
  50%{box-shadow:0 8px 35px rgba(139,69,19,0.8)}
}

/* 魍魉之匣选择弹窗样式 - 横排卡牌布局 */
.wangliang-modal{
  min-width:320px;
  max-width:90vw;
  padding:20px 25px;
  text-align:center;
}
.wangliang-modal .modal-hint{color:#aaa;font-size:14px;margin:4px 0 0}
.wangliang-modal .modal-hint b{color:#ff6b6b;font-size:15px}
/* 横排卡牌容器 */
.wl-card-row{
  display:flex;
  gap:14px;
  justify-content:center;
  margin:18px 0 20px;
  flex-wrap:wrap;
}
/* 单张卡牌 */
.wl-card{
  width:120px;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;
  padding:10px 8px 12px;
  border:2px solid #555;
  border-radius:10px;
  background:rgba(0,0,0,0.35);
  cursor:pointer;
  transition:all 0.2s ease;
  position:relative;
}
.wl-card:hover:not(.empty){
  border-color:#888;
  background:rgba(0,0,0,0.5);
  transform:translateY(-2px);
}
/* 弃置选中态 */
.wl-card.discarding{
  border-color:#e55;
  background:rgba(204,60,60,0.15);
  box-shadow:0 0 12px rgba(204,60,60,0.4);
}
/* 空牌库态 */
.wl-card.empty{
  opacity:0.45;
  cursor:default;
  border-style:dashed;
}
/* 玩家名标签 */
.wl-player-tag{
  font-size:12px;
  color:#ccc;
  font-weight:bold;
  padding:2px 8px;
  border-radius:4px;
  background:rgba(255,255,255,0.08);
  width:100%;
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.wl-player-tag.self{
  color:#ffd700;
  background:rgba(255,215,0,0.15);
  border:1px solid rgba(255,215,0,0.3);
}
/* 卡牌图区 */
.wl-card-art-wrap{
  width:90px;
  height:120px;
  border-radius:6px;
  overflow:hidden;
  position:relative;
  border:1px solid #444;
  background:#1a1a2e;
}
.wl-card-art{
  width:100%;
  height:100%;
  object-fit:cover;
}
/* 弃置标记覆盖层 */
.wl-discard-mark{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(180,40,40,0.55);
  font-size:36px;
}
/* 空牌库占位 */
.wl-empty-art{
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(80,80,80,0.3);
  border-style:dashed;
}
.wl-empty-art span{
  color:#666;
  font-size:22px;
  font-weight:bold;
}
/* 卡名 + HP */
.wl-card-name{
  font-size:13px;
  color:#fff;
  font-weight:bold;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:110px;
}
.wl-card-hp{
  font-size:12px;
  color:#ff6b6b;
}
.wl-empty-text{
  color:#666;
  font-weight:normal;
}
/* 底部按钮 */
.wangliang-actions{
  display:flex;
  gap:15px;
  justify-content:center;
  margin-top:4px;
}
.wangliang-actions .confirm-btn{
  padding:10px 28px;
  background:linear-gradient(135deg, #4a9 0%, #387 100%);
  border:none;
  border-radius:8px;
  color:#fff;
  font-size:14px;
  font-weight:bold;
  cursor:pointer;
  transition:all 0.2s ease;
}
.wangliang-actions .confirm-btn:hover{
  transform:scale(1.05);
  box-shadow:0 4px 15px rgba(68,170,153,0.5);
}
.wangliang-actions .cancel-btn{
  padding:10px 18px;
  background:rgba(255,255,255,0.08);
  border:1px solid #555;
  border-radius:8px;
  color:#999;
  font-size:13px;
  cursor:pointer;
  transition:all 0.2s ease;
}
.wangliang-actions .cancel-btn:hover{
  background:rgba(255,255,255,0.15);
  color:#fff;
}

.pile-view-panel{
  background:linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%);
  border:calc(var(--s) * 3) solid #D4A574;
  border-radius:calc(var(--s) * 12);
  padding:calc(var(--s) * 25) calc(var(--s) * 30);
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
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 168);
  border-radius:calc(var(--s) * 6);
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  border:calc(var(--s) * 2) solid #666;
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
  width:calc(var(--s) * 100);
  height:calc(var(--s) * 140);
  border-radius:calc(var(--s) * 6);
  cursor:pointer;
  transition:all .15s;
  border:calc(var(--s) * 2) solid #D4A574;
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
.shiki-card.selecting{border:calc(var(--s) * 2) dashed #ff9800;animation:pulse 1s infinite}

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
  border:calc(var(--s) * 2) solid #D4A574;
  border-radius:calc(var(--s) * 12);
  padding:calc(var(--s) * 16) calc(var(--s) * 20);
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

/* 三味等卡牌的动态效果预览 */
.tooltip-dynamic{
  margin-top:10px;
  padding:8px 10px;
  background:linear-gradient(135deg, rgba(255,152,0,0.15), rgba(255,87,34,0.15));
  border-left:3px solid #ff9800;
  border-radius:4px;
}
.tooltip-dynamic p{
  margin:0;
  font-size:13px;
  color:#ffcc80;
  line-height:1.4;
  font-weight:500;
}
</style>

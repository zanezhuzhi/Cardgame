<!--
  多人游戏大厅
  @file client/src/views/Lobby.vue
-->
<template>
  <div class="lobby-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="sakura"></div>
      <div class="sakura"></div>
      <div class="sakura"></div>
    </div>
    
    <!-- 标题 -->
    <header class="lobby-header">
      <h1 class="game-title">御魂传说</h1>
      <p class="game-subtitle">百鬼夜行</p>
    </header>
    
    <!-- 连接状态 -->
    <div class="connection-bar" :class="connectionStatus">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
      <span class="latency" v-if="isConnected">{{ latency }}ms</span>
    </div>
    
    <!-- 主内容 -->
    <main class="lobby-main">
      <!-- 未连接状态：显示连接按钮 -->
      <div v-if="!isConnected" class="connect-panel">
        <div class="player-name-input">
          <label>玩家名称</label>
          <input 
            v-model="playerName" 
            placeholder="输入你的名称"
            maxlength="12"
            @keyup.enter="connectToServer"
          />
        </div>
        <button class="btn primary large" @click="connectToServer" :disabled="connecting">
          {{ connecting ? '连接中...' : '连接服务器' }}
        </button>
        <button class="btn secondary" @click="playSinglePlayer">
          单人模式
        </button>
      </div>
      
      <!-- 已连接状态：显示大厅 -->
      <div v-else-if="!currentRoom" class="lobby-panel">
        <!-- 玩家信息区（左上角） -->
        <div class="player-profile">
          <div class="player-avatar-block" :style="{ background: avatarColor }">
            <span class="avatar-initial">{{ playerName?.charAt(0)?.toUpperCase() || 'P' }}</span>
          </div>
          <div class="player-name-display">{{ playerName }}</div>
        </div>
        
        <!-- 模式选择 -->
        <div class="mode-tabs">
          <button 
            :class="['tab', { active: activeTab === 'rooms' }]"
            @click="activeTab = 'rooms'"
          >
            🏠 房间列表
          </button>
          <button 
            :class="['tab', { active: activeTab === 'create' }]"
            @click="activeTab = 'create'"
          >
            ➕ 创建房间
          </button>
          <button 
            :class="['tab', { active: activeTab === 'join' }]"
            @click="activeTab = 'join'"
          >
            🔗 加入房间
          </button>
        </div>
        
        <!-- 房间列表 -->
        <div v-if="activeTab === 'rooms'" class="tab-content rooms-list">
          <div class="list-header">
            <span>公开房间</span>
            <button class="btn small" @click="refreshRooms">🔄 刷新</button>
          </div>
          <div v-if="loadingRooms" class="loading">加载中...</div>
          <div v-else-if="rooms.length === 0" class="empty-list">
            暂无公开房间，创建一个吧！
          </div>
          <div v-else class="room-items">
            <div 
              v-for="room in rooms" 
              :key="room.id"
              class="room-item"
              @click="joinRoom(room.id)"
            >
              <div class="room-info">
                <span class="room-name">{{ room.name || room.config?.name || `房间 ${room.id}` }}</span>
                <span class="room-host">房主: {{ room.hostName || getHostName(room) }}</span>
              </div>
              <div class="room-status">
                <span class="player-count">
                  👥 {{ room.players?.length || 0 }}/{{ room.maxPlayers || room.config?.maxPlayers || 6 }}
                </span>
                <span :class="['status-badge', room.status]">
                  {{ room.status === 'waiting' ? '等待中' : '游戏中' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 创建房间 -->
        <div v-if="activeTab === 'create'" class="tab-content create-room">
          <div class="form-group">
            <label>房间名称</label>
            <input v-model="createConfig.name" placeholder="我的房间" maxlength="20" />
          </div>
          <div class="form-group">
            <label>最大人数</label>
            <div class="player-select">
              <button 
                v-for="n in [3, 4, 5, 6]" 
                :key="n"
                :class="['num-btn', { active: createConfig.maxPlayers === n }]"
                @click="createConfig.maxPlayers = n"
              >
                {{ n }}人
              </button>
            </div>
          </div>
          <div class="form-group checkbox">
            <label>
              <input type="checkbox" v-model="createConfig.isPrivate" />
              私密房间（不显示在列表中）
            </label>
          </div>
          <div class="form-group" v-if="createConfig.isPrivate">
            <label>房间密码（可选）</label>
            <input v-model="createConfig.password" type="password" placeholder="留空则无密码" />
          </div>
          <button class="btn primary large" @click="createRoom" :disabled="creating">
            {{ creating ? '创建中...' : '创建房间' }}
          </button>
        </div>
        
        <!-- 加入房间 -->
        <div v-if="activeTab === 'join'" class="tab-content join-room">
          <div class="form-group">
            <label>房间号</label>
            <input 
              v-model="joinRoomId" 
              placeholder="输入6位房间号"
              maxlength="6"
              @input="joinRoomId = joinRoomId.toUpperCase()"
            />
          </div>
          <div class="form-group">
            <label>密码（如果需要）</label>
            <input v-model="joinPassword" type="password" placeholder="无密码则留空" />
          </div>
          <button class="btn primary large" @click="joinRoomById" :disabled="joining || !joinRoomId">
            {{ joining ? '加入中...' : '加入房间' }}
          </button>
        </div>
        
        <!-- 底部操作 -->
        <div class="lobby-footer">
          <div class="footer-left">
            <div class="online-count">
              <span class="online-dot"></span>
              <span>在线: {{ onlineCount }} 人</span>
            </div>
            <button class="btn secondary" @click="disconnect">断开连接</button>
          </div>
          <div class="footer-right">
            <button class="btn secondary" @click="playSinglePlayer">单人模式</button>
            <button class="btn primary large match-btn" @click="startMatching" :disabled="isMatching">
              <span v-if="!isMatching">🎮 开始游戏</span>
              <span v-else>匹配中... {{ matchingTime }}s</span>
            </button>
          </div>
        </div>
        
        <!-- 匹配中遮罩 -->
        <div v-if="isMatching" class="matching-overlay">
          <div class="matching-modal">
            <div class="matching-spinner"></div>
            <h3>正在匹配</h3>
            <p class="matching-timer">{{ matchingTime }} 秒</p>
            <p class="matching-hint">正在寻找其他玩家...</p>
            <button class="btn secondary" @click="cancelMatching">取消匹配</button>
          </div>
        </div>
        
        <!-- 确认阶段弹窗 -->
        <div v-if="isInConfirmPhase" class="matching-overlay">
          <div class="confirm-modal">
            <h3>🎯 找到对局！</h3>
            <p class="confirm-timer">{{ confirmCountdown }} 秒内确认</p>
            
            <!-- 玩家列表 -->
            <div class="confirm-players">
              <div 
                v-for="player in confirmPlayers" 
                :key="player.id"
                :class="['confirm-player', { 
                  confirmed: player.confirmed, 
                  ai: player.isAI,
                  me: player.id === playerId
                }]"
              >
                <div class="confirm-avatar" :style="{ background: getPlayerColor(player.name) }">
                  <span v-if="player.isAI">🤖</span>
                  <span v-else>{{ player.name?.charAt(0)?.toUpperCase() || 'P' }}</span>
                </div>
                <div class="confirm-info">
                  <span class="confirm-name">
                    {{ player.name }}
                    <span v-if="player.id === playerId" class="me-tag">(我)</span>
                    <span v-if="player.isAI" class="ai-tag">AI</span>
                  </span>
                  <span class="confirm-status">
                    {{ player.confirmed ? '✅ 已确认' : '⏳ 等待确认' }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- 操作按钮 -->
            <div class="confirm-actions">
              <button 
                class="btn primary large" 
                @click="confirmMatch" 
                :disabled="hasConfirmed"
              >
                {{ hasConfirmed ? '✅ 已确认' : '🎮 确认参战' }}
              </button>
              <button class="btn secondary" @click="rejectMatch">取消</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 房间等待界面 -->
      <div v-else class="room-panel">
        <div class="room-header">
          <h2>{{ currentRoom.name }}</h2>
          <span class="room-code">房间号: {{ currentRoom.id }}</span>
          <button class="btn small" @click="copyRoomCode">📋 复制</button>
        </div>
        
        <!-- 玩家列表 -->
        <div class="players-grid">
          <div 
            v-for="(player, index) in currentRoom.players" 
            :key="player.id"
            :class="['player-slot', { 
              ready: player.isReady, 
              host: player.isHost,
              me: player.id === playerId,
              disconnected: !player.isConnected
            }]"
          >
            <div class="player-avatar">
              <span class="avatar-icon">{{ player.isHost ? '👑' : '🎭' }}</span>
            </div>
            <div class="player-info">
              <span class="player-name">
                {{ player.name }}
                <span v-if="player.id === playerId" class="me-tag">(我)</span>
              </span>
              <span class="player-status">
                {{ !player.isConnected ? '🔴 断线' : player.isReady ? '✅ 准备' : '⏳ 未准备' }}
              </span>
            </div>
          </div>
          <!-- 空位 -->
          <div 
            v-for="i in emptySlots" 
            :key="'empty-' + i"
            class="player-slot empty"
          >
            <div class="player-avatar">
              <span class="avatar-icon">❓</span>
            </div>
            <div class="player-info">
              <span class="player-name">等待加入...</span>
            </div>
          </div>
        </div>
        
        <!-- 房间操作 -->
        <div class="room-actions">
          <button 
            v-if="!isHost"
            :class="['btn', 'large', isReady ? 'secondary' : 'primary']"
            @click="toggleReady"
          >
            {{ isReady ? '取消准备' : '准备' }}
          </button>
          <button 
            v-if="isHost"
            class="btn primary large"
            @click="startGame"
            :disabled="!canStart"
          >
            {{ canStart ? '开始游戏' : `等待玩家准备 (${readyCount}/${currentRoom.players.length})` }}
          </button>
          <button class="btn secondary" @click="leaveRoom">离开房间</button>
        </div>
        
        <!-- 聊天/消息区 -->
        <div class="room-messages">
          <div class="message" v-for="(msg, i) in messages" :key="i">
            {{ msg }}
          </div>
        </div>
      </div>
    </main>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error-toast" @click="error = ''">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { socketClient, type RoomInfo } from '../network/SocketClient';

const router = useRouter();

// 状态
const playerName = ref(localStorage.getItem('playerName') || '');
const connecting = ref(false);
const activeTab = ref<'rooms' | 'create' | 'join'>('rooms');
const rooms = ref<RoomInfo[]>([]);
const loadingRooms = ref(false);
const creating = ref(false);
const joining = ref(false);
const error = ref('');
const messages = ref<string[]>([]);

// 创建房间配置
const createConfig = ref({
  name: '',
  maxPlayers: 4,
  isPrivate: false,
  password: ''
});

// 加入房间
const joinRoomId = ref('');
const joinPassword = ref('');

// ===== 匹配相关状态 =====
const isMatching = ref(false);
const matchingTime = ref(0);
const matchingTimer = ref<number | null>(null);
const onlineCount = ref(0);

// ===== 确认阶段状态 =====
interface ConfirmPlayer {
  id: string;
  name: string;
  isAI: boolean;
  confirmed: boolean;
}
const isInConfirmPhase = ref(false);
const confirmSessionId = ref('');
const confirmPlayers = ref<ConfirmPlayer[]>([]);
const confirmCountdown = ref(15);
const confirmTimer = ref<number | null>(null);
const hasConfirmed = ref(false);

// 玩家头像颜色（基于名称生成固定色块）
const avatarColor = computed(() => {
  const name = playerName.value || 'Player';
  // 使用名称生成固定的HSL颜色
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `linear-gradient(135deg, hsl(${h}, 70%, 50%), hsl(${(h + 30) % 360}, 60%, 40%))`;
});

// 计算属性
const connectionStatus = computed(() => socketClient.status.value);
const isConnected = computed(() => socketClient.status.value === 'connected');
const playerId = computed(() => socketClient.playerId.value);
const currentRoom = computed(() => socketClient.currentRoom.value);
const latency = computed(() => socketClient.latency.value);
const isHost = computed(() => socketClient.isHost);

const statusText = computed(() => {
  switch (socketClient.status.value) {
    case 'connected': return '已连接';
    case 'connecting': return '连接中...';
    case 'reconnecting': return '重连中...';
    default: return '未连接';
  }
});

const isReady = computed(() => {
  const me = currentRoom.value?.players.find(p => p.id === playerId.value);
  return me?.isReady || false;
});

const readyCount = computed(() => {
  return currentRoom.value?.players.filter(p => p.isReady).length || 0;
});

const canStart = computed(() => {
  if (!currentRoom.value) return false;
  const players = currentRoom.value.players;
  if (players.length < (currentRoom.value.minPlayers || 3)) return false;
  // 房主不需要准备，其他人都要准备
  return players.every(p => p.isHost || p.isReady);
});

const emptySlots = computed(() => {
  if (!currentRoom.value) return 0;
  const max = currentRoom.value.maxPlayers || currentRoom.value.config?.maxPlayers || 6;
  const current = currentRoom.value.players?.length || 0;
  return Math.max(0, max - current);
});

// 辅助函数：获取房主名称
function getHostName(room: any): string {
  if (room.hostName) return room.hostName;
  const host = room.players?.find((p: any) => p.isHost || p.id === room.hostId);
  return host?.name || '未知';
}

// 辅助函数：基于名称生成颜色
function getPlayerColor(name: string): string {
  if (!name) return 'linear-gradient(135deg, #666, #444)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `linear-gradient(135deg, hsl(${h}, 70%, 50%), hsl(${(h + 30) % 360}, 60%, 40%))`;
}

// 方法
async function connectToServer() {
  if (!playerName.value.trim()) {
    error.value = '请输入玩家名称';
    return;
  }
  
  connecting.value = true;
  error.value = '';
  
  try {
    await socketClient.connect();
    await socketClient.setPlayerName(playerName.value.trim());
    localStorage.setItem('playerName', playerName.value.trim());
    await refreshRooms();
    // 连接成功后获取在线人数
    socketClient.send('getOnlineCount', {});
  } catch (e: any) {
    error.value = e.message || '连接失败';
  } finally {
    connecting.value = false;
  }
}

function disconnect() {
  socketClient.disconnect();
}

async function refreshRooms() {
  loadingRooms.value = true;
  try {
    console.log('[Lobby] 刷新房间列表...');
    const result = await socketClient.getRoomList();
    console.log('[Lobby] 获取到房间列表:', result);
    rooms.value = result;
  } catch (e: any) {
    console.error('[Lobby] 获取房间列表失败:', e);
    error.value = e.message || '获取房间列表失败';
  } finally {
    loadingRooms.value = false;
  }
}

async function createRoom() {
  creating.value = true;
  error.value = '';
  
  try {
    console.log('[Lobby] 尝试创建房间:', {
      name: createConfig.value.name || `${playerName.value}的房间`,
      maxPlayers: createConfig.value.maxPlayers,
      isPrivate: createConfig.value.isPrivate,
    });
    const room = await socketClient.createRoom({
      name: createConfig.value.name || `${playerName.value}的房间`,
      maxPlayers: createConfig.value.maxPlayers,
      isPrivate: createConfig.value.isPrivate,
      password: createConfig.value.password || undefined
    });
    console.log('[Lobby] 房间创建成功:', room);
    addMessage(`房间已创建: ${room.id}`);
  } catch (e: any) {
    console.error('[Lobby] 创建房间失败:', e);
    error.value = e.message || '创建房间失败';
  } finally {
    creating.value = false;
  }
}

async function joinRoom(roomId: string, password?: string) {
  joining.value = true;
  error.value = '';
  
  try {
    await socketClient.joinRoom(roomId, password);
    addMessage(`已加入房间`);
  } catch (e: any) {
    error.value = e.message || '加入房间失败';
  } finally {
    joining.value = false;
  }
}

async function joinRoomById() {
  await joinRoom(joinRoomId.value, joinPassword.value || undefined);
}

async function leaveRoom() {
  try {
    await socketClient.leaveRoom();
    messages.value = [];
  } catch (e: any) {
    error.value = e.message || '离开房间失败';
  }
}

async function toggleReady() {
  try {
    await socketClient.setReady(!isReady.value);
  } catch (e: any) {
    error.value = e.message || '设置准备状态失败';
  }
}

async function startGame() {
  try {
    await socketClient.startGame();
  } catch (e: any) {
    error.value = e.message || '开始游戏失败';
  }
}

function copyRoomCode() {
  if (currentRoom.value) {
    navigator.clipboard.writeText(currentRoom.value.id);
    addMessage('房间号已复制');
  }
}

function playSinglePlayer() {
  router.push('/game?mode=single');
}

function addMessage(msg: string) {
  messages.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (messages.value.length > 50) {
    messages.value.shift();
  }
}

// ===== 匹配相关方法 =====
function startMatching() {
  if (isMatching.value) return;
  
  console.log('[Lobby] startMatching 被调用, isConnected:', socketClient.isConnected);
  
  isMatching.value = true;
  matchingTime.value = 0;
  
  // 通知服务端开始匹配
  console.log('[Lobby] 发送 match:start 事件');
  socketClient.send('match:start', {});
  
  // 开始计时
  matchingTimer.value = window.setInterval(() => {
    matchingTime.value++;
    
    // 10秒后自动完成匹配（服务端会处理AI填充）
    // 这里只是UI显示，实际逻辑由服务端控制
    if (matchingTime.value >= 15) {
      // 超时处理（如果服务端没响应）
      console.warn('[Lobby] 匹配超时，等待服务端响应');
    }
  }, 1000);
}

function cancelMatching() {
  if (!isMatching.value) return;
  
  isMatching.value = false;
  matchingTime.value = 0;
  
  if (matchingTimer.value) {
    clearInterval(matchingTimer.value);
    matchingTimer.value = null;
  }
  
  // 通知服务端取消匹配
  socketClient.send('match:cancel', {});
}

function stopMatchingTimer() {
  if (matchingTimer.value) {
    clearInterval(matchingTimer.value);
    matchingTimer.value = null;
  }
  isMatching.value = false;
  matchingTime.value = 0;
}

// ===== 确认阶段方法 =====
function startConfirmPhase(data: { 
  sessionId: string; 
  players: ConfirmPlayer[]; 
  timeout: number;
}) {
  console.log('[Lobby] 进入确认阶段:', data);
  
  // 停止匹配计时器
  stopMatchingTimer();
  
  // 设置确认阶段状态
  isInConfirmPhase.value = true;
  confirmSessionId.value = data.sessionId;
  confirmPlayers.value = data.players;
  confirmCountdown.value = data.timeout || 15;
  hasConfirmed.value = false;
  
  // 开始倒计时
  confirmTimer.value = window.setInterval(() => {
    confirmCountdown.value--;
    if (confirmCountdown.value <= 0) {
      stopConfirmPhase();
    }
  }, 1000);
}

function stopConfirmPhase() {
  if (confirmTimer.value) {
    clearInterval(confirmTimer.value);
    confirmTimer.value = null;
  }
  isInConfirmPhase.value = false;
  confirmSessionId.value = '';
  confirmPlayers.value = [];
  confirmCountdown.value = 15;
  hasConfirmed.value = false;
}

function confirmMatch() {
  if (hasConfirmed.value) return;
  
  console.log('[Lobby] 确认匹配');
  hasConfirmed.value = true;
  socketClient.send('match:confirm', { sessionId: confirmSessionId.value });
}

function rejectMatch() {
  console.log('[Lobby] 拒绝匹配');
  socketClient.send('match:reject', { sessionId: confirmSessionId.value });
  stopConfirmPhase();
}

// 事件监听
onMounted(() => {
  // 玩家加入
  socketClient.on('playerJoined', (player: any) => {
    addMessage(`${player.name} 加入了房间`);
  });
  
  // 玩家离开
  socketClient.on('playerLeft', (playerId: string) => {
    addMessage(`有玩家离开了房间`);
  });
  
  // 准备状态
  socketClient.on('playerReady', (playerId: string, isReady: boolean) => {
    const player = currentRoom.value?.players.find(p => p.id === playerId);
    if (player) {
      addMessage(`${player.name} ${isReady ? '已准备' : '取消准备'}`);
    }
  });
  
  // 游戏开始
  socketClient.on('gameStarted', () => {
    router.push('/game?mode=multi');
  });
  
  // 被踢出
  socketClient.on('kicked', () => {
    error.value = '你被踢出了房间';
    messages.value = [];
  });
  
  // 房间被解散
  socketClient.on('disbanded', (reason: string) => {
    console.log('[Lobby] 房间被解散:', reason);
    error.value = reason || '房间已解散';
    messages.value = [];
  });
  
  // 断线
  socketClient.on('playerDisconnected', (playerId: string) => {
    const player = currentRoom.value?.players.find(p => p.id === playerId);
    if (player) {
      addMessage(`${player.name} 断线了`);
    }
  });
  
  // 重连
  socketClient.on('playerReconnected', (playerId: string) => {
    const player = currentRoom.value?.players.find(p => p.id === playerId);
    if (player) {
      addMessage(`${player.name} 重连了`);
    }
  });
  
  // ===== 匹配相关事件 =====
  // 在线人数更新
  socketClient.on('onlineCount', (count: number) => {
    onlineCount.value = count;
  });
  
  // 进入确认阶段
  socketClient.on('match:confirmPhase', (data: { sessionId: string; players: ConfirmPlayer[]; timeout: number }) => {
    console.log('[Lobby] 进入确认阶段:', data);
    startConfirmPhase(data);
  });
  
  // 确认状态更新
  socketClient.on('match:confirmUpdate', (data: { sessionId: string; playerId: string; confirmed: boolean; players: ConfirmPlayer[] }) => {
    console.log('[Lobby] 确认状态更新:', data);
    if (data.sessionId === confirmSessionId.value) {
      confirmPlayers.value = data.players;
    }
  });
  
  // 确认阶段失败（超时或有人取消）
  socketClient.on('match:confirmFailed', (data: { reason: string }) => {
    console.log('[Lobby] 确认阶段失败:', data);
    stopConfirmPhase();
    error.value = data.reason || '确认失败';
  });
  
  // 匹配成功（所有人确认后）- 进入游戏
  socketClient.on('match:found', (data: { roomId: string; players: any[] }) => {
    console.log('[Lobby] 匹配成功，进入游戏:', data);
    stopConfirmPhase();
    stopMatchingTimer();
    router.push('/game?mode=multi');
  });
  
  // 匹配失败
  socketClient.on('match:failed', (data: { reason: string }) => {
    console.log('[Lobby] 匹配失败:', data);
    stopMatchingTimer();
    stopConfirmPhase();
    error.value = data.reason || '匹配失败';
  });
  
  // 匹配取消
  socketClient.on('match:cancelled', () => {
    console.log('[Lobby] 匹配已取消');
    stopMatchingTimer();
  });
  
  // 如果已经连接（比如从其他页面返回），立即获取在线人数
  if (socketClient.isConnected) {
    socketClient.send('getOnlineCount', {});
  }
});

onUnmounted(() => {
  // 清理计时器
  stopMatchingTimer();
  stopConfirmPhase();
});
</script>

<style scoped>
.lobby-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 50%, #1e3a5f 100%);
  color: #f0e6d3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.sakura {
  position: absolute;
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, rgba(255,183,197,0.8) 0%, transparent 70%);
  border-radius: 50%;
  animation: float 15s infinite ease-in-out;
}

.sakura:nth-child(1) { left: 10%; animation-delay: 0s; }
.sakura:nth-child(2) { left: 50%; animation-delay: 5s; }
.sakura:nth-child(3) { left: 80%; animation-delay: 10s; }

@keyframes float {
  0%, 100% { transform: translateY(-100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* 标题 */
.lobby-header {
  text-align: center;
  margin-bottom: 20px;
  z-index: 1;
}

.game-title {
  font-size: 48px;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255,215,0,0.5);
  margin: 0;
}

.game-subtitle {
  font-size: 18px;
  color: #ffb7c5;
  margin: 5px 0 0;
}

/* 连接状态栏 */
.connection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0,0,0,0.3);
  border-radius: 20px;
  margin-bottom: 20px;
  z-index: 1;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #888;
}

.connection-bar.connected .status-dot { background: #4CAF50; }
.connection-bar.connecting .status-dot { background: #FFC107; animation: pulse 1s infinite; }
.connection-bar.reconnecting .status-dot { background: #FF9800; animation: pulse 1s infinite; }
.connection-bar.disconnected .status-dot { background: #f44336; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.latency {
  font-size: 12px;
  color: #888;
}

/* 主内容 */
.lobby-main {
  width: 100%;
  max-width: 600px;
  z-index: 1;
}

/* 连接面板 */
.connect-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: rgba(0,0,0,0.4);
  border: 2px solid #d4a574;
  border-radius: 12px;
  padding: 30px;
}

.player-name-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-name-input label {
  font-size: 14px;
  color: #d4a574;
}

.player-name-input input {
  padding: 12px 16px;
  font-size: 16px;
  background: rgba(0,0,0,0.3);
  border: 1px solid #d4a574;
  border-radius: 8px;
  color: #f0e6d3;
  outline: none;
}

.player-name-input input:focus {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255,215,0,0.3);
}

/* 大厅面板 */
.lobby-panel {
  background: rgba(0,0,0,0.4);
  border: 2px solid #d4a574;
  border-radius: 12px;
  overflow: hidden;
}

/* 标签页 */
.mode-tabs {
  display: flex;
  border-bottom: 1px solid #d4a574;
}

.tab {
  flex: 1;
  padding: 15px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(255,255,255,0.05);
  color: #f0e6d3;
}

.tab.active {
  background: rgba(212,165,116,0.2);
  color: #ffd700;
  border-bottom: 2px solid #ffd700;
}

/* 标签内容 */
.tab-content {
  padding: 20px;
  min-height: 300px;
}

/* 房间列表 */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.room-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border: 1px solid #555;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.room-item:hover {
  background: rgba(255,255,255,0.1);
  border-color: #d4a574;
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-name {
  font-weight: bold;
}

.room-host {
  font-size: 12px;
  color: #888;
}

.room-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.player-count {
  font-size: 14px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.waiting {
  background: rgba(76,175,80,0.3);
  color: #4CAF50;
}

.status-badge.playing {
  background: rgba(255,152,0,0.3);
  color: #FF9800;
}

.empty-list, .loading {
  text-align: center;
  color: #888;
  padding: 40px;
}

/* 表单 */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #d4a574;
  font-size: 14px;
}

.form-group input[type="text"],
.form-group input[type="password"] {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  background: rgba(0,0,0,0.3);
  border: 1px solid #555;
  border-radius: 8px;
  color: #f0e6d3;
  outline: none;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #d4a574;
}

.form-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.player-select {
  display: flex;
  gap: 10px;
}

.num-btn {
  flex: 1;
  padding: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid #555;
  border-radius: 8px;
  color: #f0e6d3;
  cursor: pointer;
  transition: all 0.2s;
}

.num-btn:hover {
  background: rgba(255,255,255,0.1);
}

.num-btn.active {
  background: rgba(212,165,116,0.3);
  border-color: #d4a574;
  color: #ffd700;
}

/* 大厅底部 */
.lobby-footer {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #333;
}

/* 房间面板 */
.room-panel {
  background: rgba(0,0,0,0.4);
  border: 2px solid #d4a574;
  border-radius: 12px;
  padding: 20px;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #333;
}

.room-header h2 {
  margin: 0;
  flex: 1;
}

.room-code {
  font-family: monospace;
  font-size: 14px;
  color: #d4a574;
  background: rgba(0,0,0,0.3);
  padding: 5px 10px;
  border-radius: 4px;
}

/* 玩家格子 */
.players-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.player-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border: 2px solid #444;
  border-radius: 10px;
  transition: all 0.2s;
}

.player-slot.ready {
  border-color: #4CAF50;
  background: rgba(76,175,80,0.1);
}

.player-slot.host {
  border-color: #ffd700;
}

.player-slot.me {
  box-shadow: 0 0 10px rgba(255,215,0,0.3);
}

.player-slot.disconnected {
  opacity: 0.5;
}

.player-slot.empty {
  opacity: 0.3;
  border-style: dashed;
}

.player-avatar {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.3);
  border-radius: 50%;
  font-size: 24px;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name {
  font-weight: bold;
}

.me-tag {
  color: #ffd700;
  font-size: 12px;
}

.player-status {
  font-size: 12px;
  color: #888;
}

/* 房间操作 */
.room-actions {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

/* 消息区 */
.room-messages {
  max-height: 150px;
  overflow-y: auto;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 10px;
}

.message {
  font-size: 12px;
  color: #888;
  padding: 3px 0;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.primary {
  background: linear-gradient(135deg, #d4a574, #b8956a);
  color: #1a1a2e;
  font-weight: bold;
}

.btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #e0b584, #c8a67a);
  transform: translateY(-2px);
}

.btn.secondary {
  background: rgba(255,255,255,0.1);
  color: #f0e6d3;
  border: 1px solid #555;
}

.btn.secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.15);
}

.btn.large {
  padding: 15px 30px;
  font-size: 16px;
  flex: 1;
}

.btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 错误提示 */
.error-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(244,67,54,0.9);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式 */
@media (max-width: 600px) {
  .game-title {
    font-size: 32px;
  }
  
  .players-grid {
    grid-template-columns: 1fr;
  }
  
  .mode-tabs {
    flex-wrap: wrap;
  }
  
  .tab {
    flex: 1 1 50%;
  }
}

/* ===== 玩家信息区 ===== */
.player-profile {
  position: absolute;
  top: 15px;
  left: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 15px;
  background: rgba(0,0,0,0.4);
  border: 1px solid #555;
  border-radius: 10px;
  z-index: 10;
}

.player-avatar-block {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.avatar-initial {
  font-size: 24px;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.player-name-display {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
}

/* ===== 大厅底部改造 ===== */
.lobby-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #333;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.online-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #888;
}

.online-dot {
  width: 8px;
  height: 8px;
  background: #4CAF50;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.match-btn {
  min-width: 150px;
  font-size: 18px !important;
  padding: 15px 30px !important;
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a) !important;
  border: 2px solid #ff8a8a !important;
  animation: matchBtnGlow 2s infinite;
}

.match-btn:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 5px 20px rgba(255,107,107,0.4);
}

@keyframes matchBtnGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(255,107,107,0.3); }
  50% { box-shadow: 0 0 20px rgba(255,107,107,0.6); }
}

/* ===== 匹配遮罩 ===== */
.matching-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.matching-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 100%);
  border: 2px solid #d4a574;
  border-radius: 16px;
  padding: 40px 60px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}

.matching-spinner {
  width: 60px;
  height: 60px;
  margin: 0 auto 20px;
  border: 4px solid #333;
  border-top-color: #d4a574;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.matching-modal h3 {
  margin: 0 0 15px;
  font-size: 24px;
  color: #ffd700;
}

.matching-timer {
  font-size: 48px;
  font-weight: bold;
  color: #d4a574;
  margin: 10px 0;
  font-family: monospace;
}

.matching-hint {
  color: #888;
  font-size: 14px;
  margin-bottom: 20px;
}

/* ===== 确认阶段弹窗 ===== */
.confirm-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 100%);
  border: 2px solid #4caf50;
  border-radius: 16px;
  padding: 30px 40px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(76,175,80,0.3);
  min-width: 400px;
  max-width: 500px;
}

.confirm-modal h3 {
  margin: 0 0 10px;
  font-size: 28px;
  color: #4caf50;
}

.confirm-timer {
  font-size: 20px;
  color: #ffd700;
  margin: 10px 0 20px;
  font-weight: bold;
}

.confirm-players {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
}

.confirm-player {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 15px;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  border: 1px solid #333;
  transition: all 0.3s ease;
}

.confirm-player.confirmed {
  border-color: #4caf50;
  background: rgba(76,175,80,0.1);
}

.confirm-player.me {
  border-color: #ffd700;
  background: rgba(255,215,0,0.1);
}

.confirm-player.ai {
  border-color: #9e9e9e;
  background: rgba(158,158,158,0.1);
}

.confirm-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.confirm-info {
  flex: 1;
  text-align: left;
}

.confirm-name {
  display: block;
  font-size: 14px;
  color: #f0e6d3;
  margin-bottom: 2px;
}

.confirm-name .me-tag {
  color: #ffd700;
  font-size: 12px;
}

.confirm-name .ai-tag {
  color: #9e9e9e;
  font-size: 12px;
  margin-left: 5px;
  background: rgba(158,158,158,0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

.confirm-status {
  font-size: 12px;
  color: #888;
}

.confirm-player.confirmed .confirm-status {
  color: #4caf50;
}

.confirm-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.confirm-actions .btn.primary {
  background: linear-gradient(135deg, #4caf50, #43a047) !important;
  border-color: #66bb6a !important;
  min-width: 150px;
}

.confirm-actions .btn.primary:disabled {
  background: linear-gradient(135deg, #2e7d32, #256629) !important;
  border-color: #388e3c !important;
  opacity: 0.8;
}
</style>

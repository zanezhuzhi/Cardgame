# 《御魂传说》UI氛围设计方案

> **核心目标**：通过UI营造沉浸式的《阴阳师》世界氛围，让玩家"走进"平安时代的百鬼夜行。

---

## 🌙 一、氛围设计哲学

### 核心理念
> "UI不是界面，是通往平安时代的入口。"

### 三层氛围系统
```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: 交互反馈层（微观）                              │
│  ── 悬停发光、点击涟漪、伤害飘字、技能特效                │
│  ── 负责每个操作的即时反馈                                │
├─────────────────────────────────────────────────────────┤
│  Layer 2: 界面UI层（中观）                               │
│  ── 卡牌、按钮、面板、弹窗                                │
│  ── 负责信息呈现和操作                                    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: 动态背景层（宏观）                             │
│  ── 粒子、光影、天气、动态纹理                            │
│  ── 负责整体世界观营造                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 二、动态背景系统（Layer 1）

### 2.1 樱花粒子系统

**视觉描述**：
- 深紫色夜空中，粉色樱花缓缓飘落
- 花瓣大小随机（2-4px），透明度渐变
- 飘落轨迹：从右上向左下，带随机风效

**技术实现**：
```typescript
// 使用 Pixi.js 粒子系统
import { ParticleContainer } from 'pixi.js'

const sakuraConfig = {
  spawnRate: 3,        // 每秒生成3朵樱花
  lifetime: 10,        // 每朵花存活10秒
  speed: { x: -20, y: 30 },  // 向左下飘落
  scale: { min: 0.5, max: 1 },
  alpha: { start: 0.8, end: 0 },
  rotation: { speed: 0.01, range: Math.PI }
}
```

**氛围作用**：
- ✅ 营造"平安时代春日"意境
- ✅ 柔化界面边界
- ✅ 增加画面呼吸感

---

### 2.2 鬼火浮光系统

**视觉描述**：
- 卡牌后方、妖怪周围有蓝绿色鬼火飘动
- 鬼火闪烁频率：每2-3秒一次
- 亮度峰值：0.4-0.6

**技术实现**：
```typescript
const ghostFireConfig = {
  color: 0x4fc3f7,  // 鬼火蓝
  glowColor: 0x1a237e,  // 深蓝光晕
  pulseSpeed: 0.03,  // 脉冲速度
  glowRadius: 50,
  intensity: 0.6
}
```

**氛围作用**：
- ✅ 强化"百鬼夜行"神秘感
- ✅ 暗示卡牌/妖怪的灵力存在
- ✅ 增加界面动态感

---

### 2.3 远山剪影系统

**视觉描述**：
- 背景底部是深色远山剪影（多层视差）
- 山峦轮廓参考富士山、神社鸟居
- 带有月光从山顶洒下的效果

**技术实现**：
```typescript
const mountains = [
  {
    image: 'mountains-far.png',
    y: -50,
    alpha: 0.3,
    parallaxSpeed: 0.1
  },
  {
    image: 'mountains-mid.png',
    y: -20,
    alpha: 0.5,
    parallaxSpeed: 0.3
  },
  {
    image: 'mountains-near.png',
    y: 0,
    alpha: 0.8,
    parallaxSpeed: 0.5
  }
]
```

**氛围作用**：
- ✅ 营造空间深度
- ✅ 暗示"平安时代"背景
- ✅ 为界面增加层次感

---

### 2.4 云雾流动系统

**视觉描述**：
- 界面边缘有薄雾缓缓流动
- 云雾纹理半透明（alpha: 0.1-0.2）
- 流动速度极慢（每20秒完成一次循环）

**技术实现**：
```typescript
const fogConfig = {
  texture: 'fog-pattern.png',
  opacity: 0.15,
  speed: 0.5,
  direction: 'left-to-right',
  layers: 3  // 多层视差
}
```

**氛围作用**：
- ✅ 营造神秘感
- ✅ 柔化硬边界面
- ✅ 增加"灵界"气息

---

## 🎴 三、沉浸式交互组件（Layer 2）

### 3.1 卡牌呼吸效果

**视觉描述**：
- 可打出的卡牌有微弱的呼吸光晕
- 光晕颜色：金色（稀有度R）→ 粉色（SR）→ 紫色（SSR）
- 呼吸频率：每3秒一次循环

**技术实现**：
```css
.card-playable {
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% {
    box-shadow: 0 0 0px rgba(212, 165, 116, 0);
  }
  50% {
    box-shadow: 0 0 20px rgba(212, 165, 116, 0.6);
  }
}
```

**氛围作用**：
- ✅ 暗示卡牌"活"着
- ✅ 引导玩家操作注意力
- ✅ 增加稀有度差异

---

### 3.2 卡牌悬停反馈

**视觉描述**：
- 鼠标悬停时，卡牌放大1.1倍
- 卡牌周围出现金色光晕
- 卡牌后方出现鬼火粒子特效
- 播放微弱的"灵力共鸣"音效

**技术实现**：
```vue
<GameCard
  @mouseenter="onHover(card)"
  @mouseleave="onLeave"
  :class="{ 'hovered': isHovered }"
/>

<style>
.card.hovered {
  transform: scale(1.1) translateZ(20px);
  box-shadow: 0 0 30px rgba(212, 165, 116, 0.8);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}
</style>
```

**氛围作用**：
- ✅ 强化"选中"的感觉
- ✅ 暗示卡牌的灵力
- ✅ 增加操作的愉悦感

---

### 3.3 按钮光晕系统

**视觉描述**：
- 主要按钮（结束回合、退治）有常亮光晕
- 光晕颜色：主题色（金色/鬼火蓝）
- 光晕强度：随鼠标距离变化（越近越强）

**技术实现**：
```typescript
function updateButtonGlow(event: MouseEvent) {
  const distance = getDistance(event.clientX, event.clientY, buttonRect)
  const intensity = Math.max(0, 1 - distance / 300)
  
  button.style.glow = `0 0 ${20 + intensity * 20}px rgba(212, 165, 116, ${0.3 + intensity * 0.5})`
}
```

**氛围作用**：
- ✅ 吸引注意力到关键操作
- ✅ 增加界面的"生命力"
- ✅ 营造神秘感

---

### 3.4 面板玻璃态效果

**视觉描述**：
- 所有面板使用毛玻璃效果
- 背景模糊度：10-15px
- 透明度：0.7-0.8
- 边框：1px半透明白色 + 金色描边

**技术实现**：
```css
.panel {
  background: rgba(26, 26, 46, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.37),
    inset 0 0 0 1px rgba(212, 165, 116, 0.3);
}
```

**氛围作用**：
- ✅ 不遮挡动态背景
- ✅ 营造"灵界"通透感
- ✅ 增加界面的高级感

---

## ✨ 四、交互反馈系统（Layer 3）

### 4.1 点击涟漪效果

**视觉描述**：
- 点击任意位置，从点击点扩散金色涟漪
- 涟漪直径：10px → 200px（逐渐消失）
- 持续时间：0.5秒

**技术实现**：
```typescript
function createRipple(x: number, y: number) {
  const ripple = document.createElement('div')
  ripple.className = 'ripple-effect'
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`
  
  document.body.appendChild(ripple)
  
  setTimeout(() => ripple.remove(), 500)
}
```

```css
.ripple-effect {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 165, 116, 0.6) 0%, transparent 70%);
  animation: ripple-expand 0.5s ease-out forwards;
  pointer-events: none;
  z-index: 9999;
}

@keyframes ripple-expand {
  to {
    width: 200px;
    height: 200px;
    opacity: 0;
  }
}
```

**氛围作用**：
- ✅ 每次操作都有"灵力波动"
- ✅ 增加操作的仪式感
- ✅ 强化"阴阳术"主题

---

### 4.2 伤害飘字特效

**视觉描述**：
- 造成伤害时，红色数字从目标身上飘出
- 数字大小：48px
- 飘动轨迹：向上30px，同时透明度降低
- 伴随轻微屏幕震动

**技术实现**：
```typescript
function showDamage(x: number, y: number, damage: number) {
  const damageText = document.createElement('div')
  damageText.className = 'damage-text'
  damageText.textContent = `-${damage}`
  damageText.style.left = `${x}px`
  damageText.style.top = `${y}px`
  
  document.body.appendChild(damageText)
  
  // 屏幕震动
  document.body.style.animation = 'shake 0.1s'
  
  setTimeout(() => damageText.remove(), 800)
}
```

```css
.damage-text {
  position: absolute;
  font-size: 48px;
  font-weight: bold;
  color: #ff5252;
  text-shadow: 
    0 0 10px rgba(255, 82, 82, 0.8),
    2px 2px 0 rgba(0, 0, 0, 0.5);
  animation: damage-float 0.8s ease-out forwards;
  pointer-events: none;
  z-index: 1000;
}

@keyframes damage-float {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-30px) scale(1.2);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
```

**氛围作用**：
- ✅ 增加战斗打击感
- ✅ 让伤害"看得见"
- ✅ 强化"百鬼退治"主题

---

### 4.3 式神技能光环

**视觉描述**：
- 式神释放技能时，卡牌周围出现光环
- 光环颜色：根据式神属性（火/水/风/雷）
- 光环旋转速度：每秒1圈
- 持续时间：1秒

**技术实现**：
```typescript
function createSkillAura(cardElement: HTMLElement, element: string) {
  const aura = document.createElement('div')
  aura.className = `skill-aura ${element}`
  
  cardElement.appendChild(aura)
  
  setTimeout(() => aura.remove(), 1000)
}
```

```css
.skill-aura {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  border: 2px solid;
  opacity: 0;
  animation: aura-pulse 1s ease-out forwards;
  pointer-events: none;
}

.skill-aura.fire { border-color: #ff5252; box-shadow: 0 0 20px rgba(255, 82, 82, 0.5); }
.skill-aura.water { border-color: #4fc3f7; box-shadow: 0 0 20px rgba(79, 195, 247, 0.5); }
.skill-aura.wind { border-color: #81c784; box-shadow: 0 0 20px rgba(129, 199, 132, 0.5); }
.skill-aura.thunder { border-color: #ffd54f; box-shadow: 0 0 20px rgba(255, 213, 79, 0.5); }

@keyframes aura-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}
```

**氛围作用**：
- ✅ 强化式神"灵力"感
- ✅ 让技能释放有视觉冲击
- ✅ 增加游戏的"仪式感"

---

## 🎵 五、音效氛围系统

### 5.1 背景音效（BGM）

| 场景 | 音乐 | 氛围作用 |
|------|------|----------|
| 主界面 | 平安神社（和风电子） | 营造神秘、宁静感 |
| 战斗阶段 | 百鬼夜行（紧张、快节奏） | 增加战斗紧张感 |
| 回合结束 | 增加鼓点、铃铛 | 强调时间流逝 |
| 获胜 | 传统乐器合奏 | 庆祝感、成就感 |

**技术实现**：
```typescript
const bgmManager = {
  mainMenu: 'bgm-main-menu.mp3',
  battle: 'bgm-battle.mp3',
  victory: 'bgm-victory.mp3',
  volume: 0.4,
  
  play(scene: string) {
    // 平滑过渡到新BGM
    this.fadeOut(currentBGM, 1000)
    this.fadeIn(this[scene], 1000)
  }
}
```

---

### 5.2 交互音效

| 操作 | 音效 | 氛围作用 |
|------|------|----------|
| 悬停卡牌 | 轻微"灵力共鸣" | 暗示卡牌有灵力 |
| 点击卡牌 | 铃铛声 | 增加操作仪式感 |
| 打出卡牌 | 风声 + 能量释放 | 强化"阴阳术"主题 |
| 造成伤害 | 短促冲击音 | 增加打击感 |
| 击杀妖怪 | 妖怪哀鸣 + 灵魂升天 | 强化"退治"主题 |
| 回合结束 | 鼓点 + 铃铛 | 强化时间流逝 |

**技术实现**：
```typescript
const sfxManager = {
  hover: new Audio('sfx-hover.wav'),
  click: new Audio('sfx-click.wav'),
  playCard: new Audio('sfx-play-card.wav'),
  damage: new Audio('sfx-damage.wav'),
  kill: new Audio('sfx-kill.wav'),
  turnEnd: new Audio('sfx-turn-end.wav'),
  
  play(effect: string) {
    this[effect].currentTime = 0
    this[effect].volume = 0.5
    this[effect].play()
  }
}
```

---

## 🌓 六、时间与天气系统

### 6.1 昼夜循环

**视觉描述**：
- 游戏支持从黄昏到深夜的时间变化
- 1个游戏回合 = 1个时间单位（黄昏 → 夜晚 → 深夜 → 黎明）
- 背景色调随时间变化

**技术实现**：
```typescript
const timePhases = {
  dusk: {
    name: '黄昏',
    background: 'linear-gradient(to bottom, #2c3e50, #4a148c)',
    lighting: 0.7
  },
  night: {
    name: '夜晚',
    background: 'linear-gradient(to bottom, #1a237e, #4a148c)',
    lighting: 0.5
  },
  midnight: {
    name: '深夜',
    background: 'linear-gradient(to bottom, #0d1344, #4a148c)',
    lighting: 0.3
  },
  dawn: {
    name: '黎明',
    background: 'linear-gradient(to bottom, #ff9800, #4a148c)',
    lighting: 0.9
  }
}

function updateTimePhase(turnNumber: number) {
  const phaseIndex = turnNumber % 4
  const phase = Object.values(timePhases)[phaseIndex]
  
  document.body.style.background = phase.background
  document.body.style.filter = `brightness(${phase.lighting})`
}
```

---

### 6.2 天气效果

| 天气 | 视觉效果 | 氛围作用 |
|------|----------|----------|
| 晴朗 | 星空闪烁 | 宁静、神秘 |
| 小雨 | 雨滴粒子 + 水面涟漪 | 忧郁、诗意 |
| 暴雨 | 强雨 + 闪电 | 紧张、战斗感 |
| 大雾 | 浓雾流动 | 神秘、未知 |
| 飘雪 | 雪花粒子 | 唯美、寒冷 |

**技术实现**：
```typescript
const weatherSystem = {
  currentWeather: 'clear',
  
  setWeather(type: string) {
    this.currentWeather = type
    
    switch(type) {
      case 'rain':
        particleSystem.start('rain')
        break
      case 'fog':
        particleSystem.start('fog')
        break
      case 'snow':
        particleSystem.start('snow')
        break
      default:
        particleSystem.stop()
    }
  }
}
```

---

## 🎯 七、整体氛围实现路线图

### 阶段一：基础氛围（1周）
- ✅ 动态背景系统（樱花粒子 + 鬼火浮光）
- ✅ 卡牌呼吸效果
- ✅ 基础交互音效

### 阶段二：增强氛围（2周）
- ✅ 远山剪影 + 云雾流动
- ✅ 悬停反馈 + 点击涟漪
- ✅ 伤害飘字特效
- ✅ 玻璃态面板

### 阶段三：高级氛围（3周）
- ✅ 式神技能光环
- ✅ 昼夜循环系统
- ✅ 天气系统
- ✅ 完整BGM + SFX

---

## 📊 八、氛围效果检查清单

### 视觉氛围
- [ ] 樱花粒子飘落（持续）
- [ ] 鬼火在卡牌后方闪烁
- [ ] 远山剪影多层视差
- [ ] 云雾缓慢流动
- [ ] 卡牌呼吸效果（可打出时）
- [ ] 悬停时卡牌放大 + 光晕
- [ ] 按钮光晕随鼠标距离变化
- [ ] 面板毛玻璃效果

### 交互氛围
- [ ] 点击涟漪效果
- [ ] 伤害飘字 + 屏幕震动
- [ ] 式神技能光环
- [ ] 击杀时妖怪消失动画

### 听觉氛围
- [ ] 背景音乐（主界面/战斗/胜利）
- [ ] 悬停音效
- [ ] 点击音效
- [ ] 打出卡牌音效
- [ ] 伤害音效
- [ ] 击杀音效
- [ ] 回合结束音效

### 时间氛围
- [ ] 昼夜循环（背景色调变化）
- [ ] 天气系统（晴/雨/雾/雪）

---

## 🎨 九、氛围调试工具

### 氛围控制面板

在游戏调试模式中，添加"氛围控制面板"：

```typescript
<AtmosphereControl>
  <button @click="toggleSakura">樱花粒子: {{ sakuraEnabled ? 'ON' : 'OFF' }}</button>
  <button @click="toggleGhostFire">鬼火浮光: {{ ghostFireEnabled ? 'ON' : 'OFF' }}</button>
  <button @click="cycleWeather">天气: {{ currentWeather }}</button>
  <button @click="cycleTimePhase">时间: {{ currentTimePhase }}</button>
  <slider v-model="musicVolume" label="BGM音量" />
  <slider v-model="sfxVolume" label="SFX音量" />
</AtmosphereControl>
```

---

## 💡 十、氛围设计原则

### 1. **适度原则**
- 不要过度动效，避免视觉疲劳
- 动效应服务于游戏体验，而不是炫技

### 2. **一致性原则**
- 所有动效应符合《阴阳师》世界观
- 配色、音效、视觉风格统一

### 3. **性能原则**
- 使用Pixi.js GPU加速
- 粒子数量控制在合理范围（< 100个同时存在）
- 动画帧率稳定在60fps

### 4. **可配置原则**
- 提供"低配模式"（关闭部分动效）
- 允许玩家调节音效/动效强度

---

## 🚀 十一、技术栈总结

| 层级 | 技术 | 用途 |
|------|------|------|
| 背景层 | Pixi.js | 粒子系统、视差滚动 |
| UI层 | Vue3 | 组件化开发 |
| 样式层 | CSS3 + Tailwind | 动画、玻璃态效果 |
| 音效层 | Web Audio API | BGM + SFX管理 |
| 时间层 | JavaScript定时器 | 昼夜循环、天气系统 |

---

**终极目标**：
> 让玩家打开游戏的那一刻，就"穿越"到了平安时代的百鬼夜行，忘记自己是在看一个UI界面。

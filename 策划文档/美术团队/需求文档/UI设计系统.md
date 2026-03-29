# 御魂传说 - UI设计系统文档

> **版本**: v1.0.0
> **最后更新**: 2026-03-26
> **基于**: 《阴阳师》美术调性 + 《杀戮尖塔》交互体验

---

## 📋 一、设计原则

### 1.1 核心价值观

- **神秘优雅**：深紫蓝背景 + 金色边框，营造日式和风氛围
- **信息清晰**：按优先级分层，关键信息高亮，避免视觉混乱
- **反馈明确**：每个交互都有视觉反馈（悬停、点击、状态变化）
- **性能优先**：轻量级动效，不影响游戏流畅度

### 1.2 响应式策略

- **桌面端**：1920x1080 为基准设计分辨率
- **笔记本**：1366x768 自适应布局
- **Electron**：全屏模式适配

---

## 🎨 二、配色系统

### 2.1 基础色板（CSS变量）

| 变量名 | 颜色值 | 用途 | 说明 |
|--------|--------|------|------|
| `--bg-primary` | `#1a1a2e` | 主背景 | 深色底 |
| `--bg-secondary` | `#2d1f3d` | 次背景 | 紫色调 |
| `--bg-tertiary` | `#1e3a5f` | 三级背景 | 蓝色调 |

### 2.2 金色系

| 变量名 | 颜色值 | 用途 |
|--------|--------|------|
| `--gold-border` | `#d4a574` | 金色边框（主要） |
| `--gold-bright` | `#ffd700` | 亮金色（高亮） |
| `--gold-dark` | `#b8860b` | 暗金色（渐变） |

### 2.3 功能色

| 变量名 | 颜色值 | 用途 |
|--------|--------|------|
| `--sakura-pink` | `#ffb7c5` | 樱花粉（装饰、标题） |
| `--ghost-fire-blue` | `#4fc3f7` | 鬼火蓝（鬼火图标） |
| `--damage-red` | `#ff6b6b` | 伤害红（伤害数值、受伤） |
| `--life-green` | `#81c784` | 生命绿（可击杀状态） |
| `--charm-gold` | `#ffc107` | 声誉金（声誉值） |

### 2.4 卡牌类型色

| 卡牌类型 | 背景渐变 | 边框色 | CSS类 |
|---------|----------|--------|-------|
| 阴阳术 | `#1565c0 → #0d47a1` | `#42a5f5` | `.hand-card.spell` |
| 御魂 | `#2e7d32 → #1b5e20` | `#66bb6a` | `.hand-card.yokai` |
| 令牌 | `#ef6c00 → #e65100` | `#ffb74d` | `.hand-card.token` |
| 恶评 | `#455a64 → #37474f` | `#78909c` | `.hand-card.penalty` |
| 鬼王 | `#6a1b9a → #4a148c` | `#ab47bc` | `.hand-card.boss` |

### 2.5 面板与玻璃态

| 变量名 | 值 | 用途 |
|--------|---|------|
| `--panel-bg` | `rgba(45, 31, 61, 0.85)` | 面板背景 |
| `--panel-border` | `rgba(212, 165, 116, 0.5)` | 面板边框 |
| `--panel-glass` | `rgba(255, 255, 255, 0.05)` | 玻璃态光效 |

---

## 📐 三、布局系统

### 3.1 间距系统（8点基准）

| 变量名 | 值 | 用途 |
|--------|---|------|
| `--space-xs` | `4px` | 微间距（图标与文字） |
| `--space-sm` | `8px` | 小间距（组件内元素） |
| `--space-md` | `16px` | 中间距（组件之间） |
| `--space-lg` | `24px` | 大间距（区块之间） |
| `--space-xl` | `32px` | 超大间距（区块组） |

### 3.2 卡牌尺寸

| 类型 | 宽度 | 高度 | 用途 |
|------|------|------|------|
| 手牌 | `120px` | `170px` | 手牌区 |
| 妖怪卡 | `100px` | `140px` | 游荡妖怪 |
| 式神卡 | `80px` | `110px` | 式神区 |
| 鬼王卡 | `140px` | `200px` | 鬼王区 |

### 3.3 圆角系统

| 变量名 | 值 | 用途 |
|--------|---|------|
| `--radius-sm` | `4px` | 小圆角（标签） |
| `--radius-md` | `8px` | 中圆角（按钮、面板） |
| `--radius-lg` | `12px` | 大圆角（弹窗） |
| `--radius-xl` | `16px` | 超大圆角（大厅卡片） |

---

## 🎴 四、组件设计规范

### 4.1 卡牌组件（GameCard）

**结构**：
```html
<div class="card card-type">
  <!-- 立绘区 -->
  <img class="card-art" src="..." />
  
  <!-- 信息栏 -->
  <div class="card-info">
    <div class="card-name">卡牌名称</div>
    <div class="card-stats">HP/伤害</div>
  </div>
  
  <!-- 状态徽章 -->
  <div class="badge" v-if="killed">已击杀</div>
</div>
```

**状态变体**：

| 状态 | 类名 | 视觉表现 |
|------|------|----------|
| 正常 | `.card` | 默认样式 |
| 受伤 | `.card.wounded` | 红色边框 + 红色背景 |
| 可击杀 | `.card.can-kill` | 绿色边框 + 发光动画 |
| 已击杀 | `.card.killed` | 粉色边框 + 骷髅徽章 |

**交互动画**：
- **悬停**：`transform: translateY(-3px)` + 阴影放大
- **点击**：轻微缩放反馈
- **拖拽**：跟随光标 + 半透明

---

### 4.2 玩家头像组件（PlayerAvatar）

**结构**：
```html
<div class="player-avatar" :class="{ active }">
  <span>{{ name.charAt(0) }}</span>
  <div class="me-badge" v-if="isMe">自己</div>
</div>
```

**样式规范**：
- **尺寸**：`48px × 48px` 圆形
- **激活状态**：金色发光边框 + 阴影
- **自己标签**：右上角小徽章

**信息展示**：
- 头像：玩家名首字
- 手牌数：🎴 N
- 声誉值：👑 N
- 鬼火值：⚡ N

---

### 4.3 按钮组件（Button）

**类型**：

| 类型 | 类名 | 背景 | 边框 |
|------|------|------|------|
| 主按钮 | `.btn.primary` | 金色渐变 | 金色 |
| 次按钮 | `.btn.secondary` | 半透明金色 | 金色 |
| 危险按钮 | `.btn.danger` | 红色渐变 | 金色 |
| 禁用态 | `.btn:disabled` | 半透明 | 无变化 |

**交互动画**：
- **悬停**：向上位移 `2px` + 阴影放大
- **点击**：轻微缩放 + 颜色加深
- **禁用**：`opacity: 0.5` + `cursor: not-allowed`

---

### 4.4 面板组件（Panel）

**结构**：
```html
<div class="panel">
  <div class="panel-title">
    <span class="panel-icon">🎴</span>
    <span class="panel-text">面板标题</span>
  </div>
  <div class="panel-content">
    <!-- 面板内容 -->
  </div>
</div>
```

**样式规范**：
- **背景**：玻璃态半透明
- **边框**：金色描边 + 内发光
- **圆角**：`8px`
- **阴影**：多层阴影营造深度感

---

### 4.5 弹窗组件（Modal）

**结构**：
```html
<div class="modal">
  <div class="modal-box">
    <div class="modal-title">弹窗标题</div>
    <div class="modal-hint">提示文字</div>
    <div class="modal-content">
      <!-- 弹窗内容 -->
    </div>
    <div class="modal-actions">
      <button class="btn primary">确认</button>
      <button class="btn secondary">取消</button>
    </div>
  </div>
</div>
```

**样式规范**：
- **遮罩**：`rgba(0, 0, 0, 0.8)` + 模糊
- **弹窗框**：渐变背景 + 金色边框
- **动画**：淡入 + 缩放

---

### 4.6 悬浮提示（Tooltip）

**结构**：
```html
<div class="card-tooltip">
  <div class="tooltip-header">
    <span class="tooltip-name">卡牌名称</span>
    <span class="tooltip-type">类型</span>
  </div>
  <div class="tooltip-stats">
    <span class="stat-item">HP: 5</span>
    <span class="stat-item">伤害: 3</span>
  </div>
  <div class="tooltip-effect">
    卡牌效果描述...
  </div>
</div>
```

**触发方式**：
- 悬停卡牌显示
- 跟随光标移动
- 延迟 `200ms` 显示

---

## 🌊 五、动效系统

### 5.1 动画时长

| 动画类型 | 时长 | 缓动函数 |
|---------|------|----------|
| 悬停反馈 | `200ms` | `ease-out` |
| 点击反馈 | `150ms` | `ease-in-out` |
| 页面切换 | `300ms` | `ease-in-out` |
| 弹窗显示 | `200ms` | `ease-out` |
| 粒子效果 | `500ms~2s` | `ease-out` |

### 5.2 关键动画

**卡牌悬停**：
```css
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(212, 165, 116, 0.3);
  transition: all 0.2s ease;
}
```

**可击杀发光**：
```css
@keyframes canKillGlow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(129, 199, 132, 0.4);
  }
  50% {
    box-shadow: 0 0 20px rgba(129, 199, 132, 0.7);
  }
}

.card.can-kill {
  animation: canKillGlow 1.5s ease-in-out infinite;
}
```

**伤害飘字**（Pixi.js粒子）：
- 从受伤点向上飘出
- 颜色：红色（伤害） / 绿色（生命）
- 动画：`scale: 0 → 1` + `opacity: 1 → 0`

---

## 📱 六、响应式适配

### 6.1 断点系统

| 断点 | 宽度 | 设备类型 |
|------|------|----------|
| mobile | `< 768px` | 手机 |
| tablet | `768px ~ 1024px` | 平板 |
| desktop | `> 1024px` | 桌面 |

### 6.2 自适应规则

- **卡牌尺寸**：桌面基准，小屏按比例缩放
- **网格布局**：自适应列数（2列 → 3列 → 4列）
- **字体大小**：`rem` 单位，基准 `16px`

---

## ♿ 七、可访问性

### 7.1 色彩对比度

| 元素 | 对比度 | 等级 |
|------|--------|------|
| 正文文字 | 7.5:1 | AAA |
| 标题文字 | 6.2:1 | AA |
| 按钮文字 | 5.8:1 | AA |

### 7.2 键盘导航

- `Tab`：聚焦可交互元素
- `Enter`/`Space`：激活按钮
- `Esc`：关闭弹窗

### 7.3 屏幕阅读器支持

- 语义化HTML标签
- `aria-label` 属性
- `role` 属性

---

## 🎯 八、组件清单

### 8.1 核心组件（必须实现）

| 组件名 | 优先级 | 文件位置 |
|--------|--------|----------|
| GameCard | P0 | `components/GameCard.vue` |
| PlayerAvatar | P0 | `components/PlayerAvatar.vue` |
| Button | P0 | `components/Button.vue` |
| Panel | P0 | `components/Panel.vue` |
| Modal | P0 | `components/Modal.vue` |
| Tooltip | P0 | `components/Tooltip.vue` |

### 8.2 游戏组件

| 组件名 | 优先级 | 说明 |
|--------|--------|------|
| YokaiCard | P0 | 妖怪卡牌 |
| ShikigamiCard | P0 | 式神卡牌 |
| BossCard | P0 | 鬼王卡牌 |
| HandCard | P0 | 手牌卡牌 |
| DamageIndicator | P1 | 伤害指示器 |
| LogEntry | P1 | 日志条目 |

---

## 🔧 九、开发指南

### 9.1 命名规范

- **组件名**：PascalCase（如 `GameCard.vue`）
- **CSS类名**：kebab-case（如 `.game-card`）
- **CSS变量**：`--` 前缀（如 `--bg-primary`）

### 9.2 文件结构

```
client/src/
├── components/
│   ├── common/          # 通用组件
│   │   ├── Button.vue
│   │   ├── Panel.vue
│   │   └── Modal.vue
│   ├── game/            # 游戏组件
│   │   ├── GameCard.vue
│   │   ├── PlayerAvatar.vue
│   │   └── YokaiCard.vue
│   └── ui/              # UI组件
│       ├── Tooltip.vue
│       ├── Badge.vue
│       └── ProgressBar.vue
├── styles/
│   ├── theme-wafuu.css  # 主题样式
│   ├── components.css   # 组件样式
│   └── animations.css   # 动画
└── App.vue              # 主应用
```

### 9.3 CSS组织

```css
/* 1. CSS变量 */
:root { ... }

/* 2. 基础重置 */
*, *::before, *::after { ... }

/* 3. 布局容器 */
.game-container { ... }

/* 4. 组件样式 */
.card { ... }
.button { ... }
.modal { ... }

/* 5. 状态变体 */
.card.wounded { ... }
.card.can-kill { ... }

/* 6. 动画 */
@keyframes canKillGlow { ... }
```

---

## 📖 十、参考资源

### 10.1 设计参考

- **《阴阳师》手游**：美术调性、配色方案
- **《杀戮尖塔》**：UI布局、交互反馈
- **《炉石传说》**：卡牌设计、动画效果

### 10.2 技术文档

- **Vue3官方文档**：https://cn.vuejs.org/
- **Vite文档**：https://cn.vitejs.dev/
- **Pixi.js文档**：https://pixijs.io/

### 10.3 内部文档

- `策划文档/交互设计.md` - UI/UX规范
- `策划文档/美术规范.md` - 美术尺寸与风格
- `docs/CLIENT_VISUAL_FX_TECH_PLAN.md` - 动效技术方案

---

**设计系统版本**：v1.0.0  
**文档维护者**：UI设计师 + 前端开发团队  
**更新周期**：根据项目需求迭代更新

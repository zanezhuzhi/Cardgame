/**
 * 御魂传说 - PendingChoice 类型定义
 * @file shared/types/pendingChoice.ts
 *
 * 所有需要玩家交互选择的场景统一通过 PendingChoice 类型描述。
 * 采用可区分联合（Discriminated Union）模式：通过 `type` 字段区分不同选择类型。
 *
 * 设计原则：
 * - 每种选择类型携带最小充分数据
 * - playerId 标识需要做出选择的玩家
 * - prompt 为可选的 UI 提示文案
 * - 前端根据 type 渲染对应的交互组件
 */

import type { CardInstance, ShikigamiCard } from './cards';

// ============ 基础 ============

/** 所有 PendingChoice 的公共字段 */
interface BasePendingChoice {
  /** 等待做出选择的玩家 ID */
  playerId: string;
  /** UI 提示文案 */
  prompt?: string;
}

// ============ 御魂效果相关 ============

/** 超度选择（唐纸伞妖等：查看牌库顶牌，是否超度） */
export interface SalvageChoice extends BasePendingChoice {
  type: 'salvageChoice';
  /** 展示的卡牌 */
  card: CardInstance;
}

/** 选择单张手牌（通用） */
export interface CardSelectChoice extends BasePendingChoice {
  type: 'cardSelect';
  /** 可选卡牌的 instanceId 列表 */
  candidates: string[];
  /** 选择原因说明 */
  reason?: string;
}

/** 选择场上妖怪目标（天邪鬼绿退治、鬼使黑等） */
export interface YokaiTargetChoice extends BasePendingChoice {
  type: 'yokaiTarget';
  /** 可选的妖怪 instanceId 列表 */
  options: string[];
}

/** 妖怪效果多选一（赤舌选项等） */
export interface YokaiChoiceOption extends BasePendingChoice {
  type: 'yokaiChoice';
  /** 文案选项列表 */
  options: string[];
}

/** 多选手牌（清姬/食发鬼等：选N张牌弃置/超度） */
export interface SelectCardsMultiChoice extends BasePendingChoice {
  type: 'selectCardsMulti';
  /** 可选卡牌的 instanceId 列表 */
  candidates: string[];
  /** 需要选择的数量 */
  count: number;
  /** 是否允许少选 */
  allowLess?: boolean;
}

/** 选择手牌置顶（花鸟卷抵抗、两面佛等） */
export interface SelectCardPutTopChoice extends BasePendingChoice {
  type: 'selectCardPutTop';
  /** 可选卡牌的 instanceId 列表 */
  candidates: string[];
  /** 需要置顶的数量 */
  count: number;
}

/** 鸣屋选择（选择一个妖怪效果执行） */
export interface MeiYaoSelectChoice extends BasePendingChoice {
  type: 'meiYaoSelect';
  /** 可选效果的描述列表 */
  options: string[];
}

/** 赤舌选择（选择抓牌/弃牌/伤害等） */
export interface AkajitaSelectChoice extends BasePendingChoice {
  type: 'akajitaSelect';
  /** 可选效果的描述列表 */
  options: string[];
}

/** 轮入道选择（选择弃置一张HP≤6的御魂，效果执行2次） */
export interface WheelMonkDiscardChoice extends BasePendingChoice {
  type: 'wheelMonkDiscard';
  /** 可选御魂的 instanceId 列表 */
  candidates: string[];
}

/** 薙魂弃牌选择（弃置1张手牌） */
export interface NaginataSoulDiscardChoice extends BasePendingChoice {
  type: 'naginataSoulDiscard';
}

/** 镇墓兽禁止退治目标选择（左手边玩家选择一个目标，本回合不能被退治） */
export interface ZhenMuShouTargetChoice extends BasePendingChoice {
  type: 'zhenMuShouTarget';
  /** 可选目标的 instanceId 列表（游荡妖怪 + 鬼王） */
  candidates: string[];
  /** 当前回合玩家的 ID（被限制的玩家） */
  restrictedPlayerId: string;
}

/** 幽谷响选择（从所有对手牌库顶展示的卡牌中选择最多3张非鬼王卡执行效果） */
export interface YouguXiangSelectChoice extends BasePendingChoice {
  type: 'youguXiangSelect';
  /** 展示的所有卡牌（带 ownerId 标记来源玩家） */
  revealedCards: Array<{
    card: CardInstance;
    ownerId: string;
    ownerName: string;
  }>;
  /** 可选择的卡牌 instanceId 列表（已过滤掉鬼王） */
  selectableCandidates: string[];
  /** 最多可选数量（默认3） */
  maxSelect: number;
}

// ============ 地藏像相关 ============

/** 地藏像打出确认（二次确认：防止误操作） */
export interface DizangConfirmChoice extends BasePendingChoice {
  type: 'dizangConfirm';
  /** 地藏像卡牌实例 */
  card: CardInstance;
}

/** 地藏像式神选择（从2张式神中选择1张） */
export interface DizangSelectShikigamiChoice extends BasePendingChoice {
  type: 'dizangSelectShikigami';
  /** 可选的式神列表（从牌库顶抽取的2张） */
  candidates: ShikigamiCard[];
}

/** 地藏像式神置换选择（式神已满时：选择替换哪个或放弃） */
export interface DizangReplaceShikigamiChoice extends BasePendingChoice {
  type: 'dizangReplaceShikigami';
  /** 新选中的式神 */
  newShikigami: ShikigamiCard;
  /** 当前拥有的式神列表 */
  currentShikigami: ShikigamiCard[];
}

// ============ 式神技能相关（新增） ============

/** 式神技能目标选择（如：大天狗选联动目标、铁鼠选妨害目标） */
export interface ShikigamiTargetChoice extends BasePendingChoice {
  type: 'shikigamiTarget';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 可选目标的 ID 列表（instanceId 或 playerId） */
  candidates: string[];
  /** 是否为多选 */
  multi?: boolean;
  /** 多选时的最大数量 */
  maxCount?: number;
}

/** 式神技能弃牌选择（座敷童子弃妖怪牌、白狼弃N张等） */
export interface ShikigamiDiscardChoice extends BasePendingChoice {
  type: 'shikigamiDiscard';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 可弃置卡牌的 instanceId 列表 */
  candidates: string[];
  /** 需要弃置的数量 */
  count: number;
  /** 是否允许少弃（白狼弃N张，N可变） */
  allowLess?: boolean;
  /** 弃牌限制条件描述（如 '只能弃妖怪牌'） */
  filter?: string;
}

/** 式神技能超度选择（酒吞童子超度手牌积酒） */
export interface ShikigamiExileChoice extends BasePendingChoice {
  type: 'shikigamiExile';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 可超度卡牌的 instanceId 列表 */
  candidates: string[];
  /** 需要超度的数量 */
  count: number;
}

/** 式神技能数值输入（书翁的可变鬼火 N） */
export interface ShikigamiNumberInput extends BasePendingChoice {
  type: 'shikigamiNumberInput';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
}

/** 式神技能确认选择（二选一：如唐纸伞妖超度/保留） */
export interface ShikigamiConfirmChoice extends BasePendingChoice {
  type: 'shikigamiConfirm';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 展示的卡牌（可选） */
  card?: CardInstance;
  /** 确认选项文案 */
  confirmLabel: string;
  /** 取消选项文案 */
  cancelLabel: string;
}

/** 式神技能多选一（萤草播种方式选择、追月神唤醒选择等） */
export interface ShikigamiOptionChoice extends BasePendingChoice {
  type: 'shikigamiOption';
  /** 技能所属式神 ID */
  shikigamiId: string;
  /** 技能名称 */
  skillName: string;
  /** 选项列表 */
  options: Array<{
    label: string;      // 显示文案
    value: string;      // 选项值
    disabled?: boolean; // 是否不可选
    tooltip?: string;   // 不可选原因提示
  }>;
}

/** 妨害抵抗选择（目标玩家选择是否使用青女房/铮） */
export interface HarassmentResistChoice extends BasePendingChoice {
  type: 'harassmentResist';
  /** 妨害发起者 ID */
  harasserId: string;
  /** 妨害技能名称 */
  skillName: string;
  /** 可用的抵抗手段 */
  resistOptions: Array<{
    source: string;     // 抵抗来源名称
    cardId?: string;    // 关联卡牌 ID
    immune: boolean;    // 是否完全免疫
    cost?: string;      // 消耗描述
  }>;
}

// ============ 联合类型 ============

/**
 * PendingChoice 联合类型
 *
 * 前端根据 `type` 字段进行类型区分（switch/if 自动窄化）
 */
export type PendingChoice =
  // 御魂效果相关
  | SalvageChoice
  | CardSelectChoice
  | YokaiTargetChoice
  | YokaiChoiceOption
  | SelectCardsMultiChoice
  | SelectCardPutTopChoice
  | MeiYaoSelectChoice
  | AkajitaSelectChoice
  | WheelMonkDiscardChoice
  | NaginataSoulDiscardChoice
  | ZhenMuShouTargetChoice
  | YouguXiangSelectChoice
  // 地藏像相关
  | DizangConfirmChoice
  | DizangSelectShikigamiChoice
  | DizangReplaceShikigamiChoice
  // 式神技能相关
  | ShikigamiTargetChoice
  | ShikigamiDiscardChoice
  | ShikigamiExileChoice
  | ShikigamiNumberInput
  | ShikigamiConfirmChoice
  | ShikigamiOptionChoice
  | HarassmentResistChoice;

/**
 * PendingChoice 所有可能的类型字面量
 * 供前端 switch 穷举检查使用
 */
export type PendingChoiceType = PendingChoice['type'];

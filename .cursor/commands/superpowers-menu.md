---
description: Superpowers 技能菜单（14 项索引 + 子代理 code-reviewer）
---

# Superpowers 技能菜单

以下技能来自 **Superpowers** 插件。需要时在聊天里输入对应 **Slash**（如 `/brainstorming`），或直接用自然语言说「按 `writing-plans` 技能来」。

## 流程与协作

| Slash / 技能 id | 用途（简短） |
|-----------------|--------------|
| `using-superpowers` | 何时加载技能、优先级（用户说明 > 技能 > 默认） |
| `brainstorming` | 做功能、改行为前先对齐意图与需求 |
| `writing-plans` | 多步骤任务：先写可执行计划再动手 |
| `executing-plans` | 已有书面计划时，分阶段执行并设检查点 |
| `dispatching-parallel-agents` | 多件互不依赖的事，并行交给多个代理 |
| `subagent-driven-development` | 当前会话里用子代理分工推进实现 |

## 工程实践

| Slash / 技能 id | 用途（简短） |
|-----------------|--------------|
| `test-driven-development` | 先写/补测试，再写实现（若项目规则禁用 TDD 则以规则为准） |
| `systematic-debugging` | 遇 Bug / 异常行为：系统化复现、假设、验证再改 |
| `verification-before-completion` | 宣称完成、合并或提 PR 前：先跑验证命令并保留证据 |

## 评审与收尾

| Slash / 技能 id | 用途（简短） |
|-----------------|--------------|
| `requesting-code-review` | 大块改完或合并前：如何发起、交代上下文 |
| `receiving-code-review` | 收到评审意见：先核实再改，避免盲从 |
| `finishing-a-development-branch` | 测试通过后：合并 / PR / 清理分支选项 |
| `using-git-worktrees` | 需要与当前工作区隔离时，用 worktree 开分支干活 |

## 维护技能库

| Slash / 技能 id | 用途（简短） |
|-----------------|--------------|
| `writing-skills` | 编写、修改或验收自定义 Skill 文档 |

## Subagent（非 SKILL 文件）

- **code-reviewer**：较大一步实现完成后，对照原计划与代码规范做评审；在 Agent 中可说明「用 code-reviewer 子代理」。

## 说明

- **Notion / Figma / Miro**、`excel2html`、`uip` 等 **不属于** Superpowers，勿与此表混淆。
- 项目若已在 `AGENTS.md` 或 `.cursor/rules` 中写明流程偏好，**以项目规则为准**，可覆盖技能默认要求。

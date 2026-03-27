#!/usr/bin/env node
/**
 * 御魂传说 cardgame-mcp-server
 * 为 AI Agent 提供项目专属工具集
 *
 * 工具列表：
 *  - read_planning_doc    读取策划文档
 *  - list_planning_docs   列出所有策划文档
 *  - read_file            读取代码文件
 *  - write_file           写入代码文件
 *  - list_files           列出目录文件
 *  - run_tests            运行单元测试
 *  - git_status           查看 Git 状态
 *  - git_commit           提交代码
 *  - github_post_comment  在 Issue/PR 发评论
 *  - github_create_pr     创建 Pull Request
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { readPlanningDocTool, listPlanningDocsTool } from './tools/readPlanningDoc.js';
import { readFileTool, writeFileTool, listFilesTool } from './tools/readWriteCode.js';
import { runTestsTool } from './tools/runTests.js';
import { gitStatusTool, gitCommitTool } from './tools/gitTools.js';
import { githubPostCommentTool, githubCreatePRTool } from './tools/githubTools.js';

// 所有工具定义
const ALL_TOOLS = [
  readPlanningDocTool,
  listPlanningDocsTool,
  readFileTool,
  writeFileTool,
  listFilesTool,
  runTestsTool,
  gitStatusTool,
  gitCommitTool,
  githubPostCommentTool,
  githubCreatePRTool,
];

// 工具处理器映射
const TOOL_HANDLERS: Record<string, (args: unknown) => Promise<unknown>> = {
  read_planning_doc:   (args) => readPlanningDocTool.handler(args as any),
  list_planning_docs:  (args) => listPlanningDocsTool.handler(args as any),
  read_file:           (args) => readFileTool.handler(args as any),
  write_file:          (args) => writeFileTool.handler(args as any),
  list_files:          (args) => listFilesTool.handler(args as any),
  run_tests:           (args) => runTestsTool.handler(args as any),
  git_status:          (args) => gitStatusTool.handler(args as any),
  git_commit:          (args) => gitCommitTool.handler(args as any),
  github_post_comment: (args) => githubPostCommentTool.handler(args as any),
  github_create_pr:    (args) => githubCreatePRTool.handler(args as any),
};

// 启动 MCP Server
const server = new Server(
  { name: 'cardgame-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// 列出所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// 执行工具
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = TOOL_HANDLERS[name];

  if (!handler) {
    return {
      content: [{ type: 'text', text: `未知工具: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handler(args ?? {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `工具执行失败: ${err}` }],
      isError: true,
    };
  }
});

// 启动
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('cardgame-mcp-server 已启动');

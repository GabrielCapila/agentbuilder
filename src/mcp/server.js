// src/mcp/server.js
import getFinishedGamesStats from './tools/getFinishedGamesStats.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getMonthTopUser from './tools/getMonthTopUser.js';
import getGameGuesses from './tools/getGameGuesses.js';
import getTodayNextFixtures from './tools/getTodayNextFixtures.js';
import { info } from '../utils/logger.js';

// Cria a instância do servidor MCP
const mcpServer = new McpServer({
  name: 'palpitefc-mariadb',
  version: '1.0.0',
  systemPrompt: 'Você é um agente especialista em palpites de futebol. Responda sempre de forma clara, objetiva e contextualizada ao domínio esportivo. Utilize as ferramentas registradas para buscar dados quando necessário.',
});

/**
 * Registra uma ferramenta no servidor MCP.
 * @param {object} tool - Objeto da ferramenta com name, description, schema e handler.
 */
const registerTool = (tool) => {
  mcpServer.tool(tool.name, tool.description, tool.schema, tool.handler);
  info('Ferramenta MCP registrada.', { toolName: tool.name });
};

// Registro das ferramentas
registerTool(getMonthTopUser);
registerTool(getGameGuesses);
registerTool(getTodayNextFixtures);
registerTool(getFinishedGamesStats);

export default mcpServer;

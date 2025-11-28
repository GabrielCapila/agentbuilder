// src/mcp/server.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getMonthTopUser from './tools/getMonthTopUser.js';
import { info } from '../utils/logger.js';

// Cria a instância do servidor MCP
const mcpServer = new McpServer({
  name: 'palpitefc-mariadb',
  version: '1.0.0',
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

export default mcpServer;

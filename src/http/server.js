// src/http/server.js
import http from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import mcpServer from '../mcp/server.js';
import { info, error } from '../utils/logger.js';

const PORT = Number(process.env.PORT || 5555);

// Cria o transportador HTTP para o servidor MCP
const transport = new StreamableHTTPServerTransport({
  enableJsonResponse: true,
});

// Conecta o servidor MCP ao transportador
mcpServer
  .connect(transport)
  .then(() => {
    info('Servidor MCP conectado ao transportador HTTP.');
  })
  .catch((err) => {
    error('Falha ao conectar o servidor MCP ao transportador.', {
      error: err.message,
    });
    process.exit(1);
  });

/**
 * Middleware de autenticação e logging.
 * @param {http.IncomingMessage} req - Objeto de requisição.
 * @param {http.ServerResponse} res - Objeto de resposta.
 * @returns {boolean} - Retorna true se a requisição deve ser processada, false se a resposta foi enviada.
 */
const authAndLogMiddleware = (req, res) => {
  info('Nova request HTTP', { method: req.method, url: req.url });

  // Auth antes de tudo
  const auth = req.headers.authorization;
  const expected = `Bearer ${process.env.API_KEY}`;

  if (!auth || auth !== expected) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    info('Auth falhou', { status: 401, authHeader: auth });
    return false;
  }

  info('Auth OK', { status: 200 });

  // Logging da resposta
  const originalWrite = res.write;
  const originalEnd = res.end;
  let responseChunks = [];

  res.write = function (chunk, ...args) {
    responseChunks.push(Buffer.from(chunk));
    return originalWrite.call(this, chunk, ...args);
  };

  res.end = function (chunk, ...args) {
    if (chunk) responseChunks.push(Buffer.from(chunk));
    const fullBody = Buffer.concat(responseChunks).toString('utf8');

    info('Resposta HTTP enviada', {
      status: res.statusCode,
      headers: res.getHeaders(),
      body: fullBody || '<vazio>',
    });

    return originalEnd.call(this, chunk, ...args);
  };

  return true;
};

// Cria o servidor HTTP
const httpServer = http.createServer((req, res) => {
  if (authAndLogMiddleware(req, res)) {
    // ❗ NÃO Leia o body. NÃO toque no stream. NÃO adicione propriedades.
    transport.handleRequest(req, res);
  }
});

/**
 * Inicia o servidor HTTP.
 */
export const startServer = () => {
  httpServer.listen(PORT, () => {
    info('Servidor HTTP rodando', { url: `http://0.0.0.0:${PORT}` });
  });
};

import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import { z } from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = Number(process.env.PORT || 3333);

// ======================================================
// 🧠 1. Criar MCP Server
// ======================================================
const server = new McpServer({
  name: 'palpitefc-mariadb',
  version: '1.0.0'
});

// ======================================================
// 🔌 2. Conexão com MariaDB
// ======================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 6,
  queueLimit: 0,
  timezone: 'Z'
});

function monthRange({ year, month }) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

// ======================================================
// 🔧 3. TOOL: get-month-top-user
// ======================================================
server.tool(
  'get-month-top-user',
  'Retorna o usuário com maior pontuação no mês.',
  {
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(1970).max(9999).optional()
  },
  async ({ month, year }) => {
    try {
      const now = new Date();
      const y = year ?? now.getFullYear();
      const m = month ?? (now.getMonth() + 1);

      const startStr = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
      const endStr =
        m === 12
          ? `${y + 1}-01-01 00:00:00`
          : `${y}-${String(m + 1).padStart(2, '0')}-01 00:00:00`;

      const sql = `
        SELECT
          u.id           AS userId,
          u.name         AS name,
          u.email        AS email,
          SUM(p.points)  AS total_points
        FROM userPoints p
        JOIN users u ON u.id = p.userId
        WHERE p.createdAt >= ? AND p.createdAt < ?
        GROUP BY u.id, u.name, u.email
        ORDER BY total_points DESC
        LIMIT 1
      `;

      const params = [startStr, endStr];
      
      const [rows] = await pool.query(sql, params);
      const top = Array.isArray(rows) && rows.length ? rows[0] : null;

      return {
        content: [
          {
            type: 'text',
            text: top
              ? `Top de ${m}/${y}: ${top.name} (${top.email}) com ${top.total_points} pontos.`
              : `Nenhum ponto encontrado em ${m}/${y}.`
          },
          {
            type: 'json',
            json: { month: m, year: y, topUser: top }
          }
        ]
      };
    } catch (err) {
      console.error('ERRO get-month-top-user:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar ranking.' }]
      };
    }
  }
);

// ======================================================
// 🌐 4. HTTP Server + SSE para o Agent Builder
// ======================================================
const app = express();
app.use(express.json());

// Criar transporte (SSE + JSON)
const transport = new StreamableHTTPServerTransport({
  enableJsonResponse: true
});

// Conectar o MCP server ao transporte (somente uma vez)
await server.connect(transport);

// Bearer simples
function checkAuth(req, res, next) {
  const auth = req.headers['authorization'];
  const expected = `Bearer ${process.env.API_KEY}`;

  if (!auth || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// SSE Handshake
app.get('/mcp', checkAuth, (req, res) => {
  console.log(`🌐 GET /mcp (handshake) req Accept:`, req.headers.accept);
  transport.handleRequest(req, res);
});

// JSON-RPC (tools.list, tools.call)
app.post('/mcp', checkAuth, (req, res) => {
  console.log('📥 POST /mcp JSON-RPC request');
  transport.handleRequest(req, res);
});

// Start
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MCP rodando em http://0.0.0.0:${PORT}/mcp`);
});

// Shutdown clean
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    try { await pool.end(); } catch {}
    httpServer.close(() => process.exit(0));
  });
}
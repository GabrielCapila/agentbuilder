import 'dotenv/config';
import http from 'http';
import mysql from 'mysql2/promise';
import { z } from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = Number(process.env.PORT || 5555);

// ---------------------------------------------------
// DB
// ---------------------------------------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 6,
  queueLimit: 0,
  timezone: 'Z',
});

// ---------------------------------------------------
// MCP Server
// ---------------------------------------------------
const server = new McpServer({
  name: 'palpitefc-mariadb',
  version: '1.0.0'
});

// ---------------------------------------------------
// Tool
// ---------------------------------------------------
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

      const [rows] = await pool.query(sql, [startStr, endStr]);
      const top = rows?.[0];

      return {
        content: [
          {
            type: 'text',
            text: top
              ? `Top de ${m}/${y}: ${top.name} (${top.email}) com ${top.total_points} pontos.`
              : `Nenhum ponto encontrado em ${m}/${y}.`
          }
        //   {
        //     type: 'json',
        //     json: { month: m, year: y, topUser: top }
        //   }
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

// ---------------------------------------------------
// HTTP Transport
// ---------------------------------------------------
const transport = new StreamableHTTPServerTransport({
  endpoint: "/mcp",
  enableJsonResponse: true
});

await server.connect(transport);

http.createServer((req, res) => {
  console.log("🔥 Nova request MCP", req.method, req.url);

  // Auth antes de tudo
  const auth = req.headers["authorization"];
  const expected = `Bearer ${process.env.API_KEY}`;

  if (!auth || auth !== expected) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  console.log("✅ Auth OK — repassando req intacta");
  const originalWrite = res.write;
  const originalEnd = res.end;

  let responseChunks = [];

  res.write = function (chunk, ...args) {
    responseChunks.push(Buffer.from(chunk));
    return originalWrite.call(this, chunk, ...args);
  };

  res.end = function (chunk, ...args) {
    if (chunk) responseChunks.push(Buffer.from(chunk));

    const fullBody = Buffer.concat(responseChunks).toString("utf8");

    console.log("📤 RESPOSTA MCP SAINDO:");
    console.log("➡️ Status:", res.statusCode);
    console.log("➡️ Headers:", JSON.stringify(res.getHeaders(), null, 2));
    console.log("➡️ Body:", fullBody || "<vazio>");

    return originalEnd.call(this, chunk, ...args);
  };

  // ❗ NÃO Leia o body. NÃO toque no stream. NÃO adicione propriedades.
  transport.handleRequest(req, res);
}).listen(PORT, () => {
  console.log(`🚀 MCP rodando em http://0.0.0.0:${PORT}/mcp`);
});

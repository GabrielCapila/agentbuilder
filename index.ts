import 'dotenv/config';
import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server';
import {
  TextContent,
  EmbeddedResource,
  Tool,
  Prompt,
  Resource,
  PromptMessage,
  PromptArgument,
  GetPromptResult
} from '@modelcontextprotocol/sdk/types';

import mysql from "mysql2/promise";


// ===============================================================
// 🔧 1. Conexão MariaDB com Pool
// ===============================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 6,
  queueLimit: 0
});


async function executeQuery(query: string) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(query);
    return rows;
  } finally {
    conn.release();
  }
}

// insights em memória
const insights: string[] = [];


// ===============================================================
// 🧠 2. Criar MCP Server
// ===============================================================
const server = new Server({
  name: "mariadb-mcp",
  version: "1.0.0"
});


// ===============================================================
// 📚 3. Resource: memo://insights
// ===============================================================
server.resource.list(async () => {
  return [
    {
      uri: "memo://insights",
      name: "Business Insights Memo",
      description: "Memo contendo insights acumulados",
      mimeType: "text/plain"
    } satisfies Resource
  ];
});

server.resource.read(async ({ uri }) => {
  if (uri !== "memo://insights") {
    throw new Error("Unknown resource: " + uri);
  }

  if (insights.length === 0) {
    return "No insights yet.";
  }

  return insights.map(i => `• ${i}`).join("\n");
});


// ===============================================================
// 🧰 4. Tools registradas
// ===============================================================

// ---- list_tables ----
server.tool.add({
  name: "list_tables",
  description: "Lista as tabelas disponíveis no banco MariaDB",
  inputSchema: { type: "object", properties: {} }
}, async () => {
  const rows = await executeQuery("SHOW TABLES;");
  return [new TextContent(JSON.stringify(rows, null, 2))];
});


// ---- describe_table ----
server.tool.add({
  name: "describe_table",
  description: "Mostra o schema de uma tabela",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" }
    },
    required: ["table"]
  }
}, async ({ table }) => {
  const rows = await executeQuery(`DESCRIBE \`${table}\`;`);
  return [new TextContent(JSON.stringify(rows, null, 2))];
});


// ---- read_query ----
server.tool.add({
  name: "read_query",
  description: "Executa SELECT no banco",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" }
    },
    required: ["query"]
  }
}, async ({ query }) => {
  if (!query.trim().toUpperCase().startsWith("SELECT")) {
    throw new Error("read_query aceita apenas SELECT.");
  }

  const rows = await executeQuery(query);
  return [new TextContent(JSON.stringify(rows, null, 2))];
});


// ---- write_query ----
server.tool.add({
  name: "write_query",
  description: "Executa INSERT, UPDATE ou DELETE",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" }
    },
    required: ["query"]
  }
}, async ({ query }) => {
  if (query.trim().toUpperCase().startsWith("SELECT")) {
    throw new Error("write_query NÃO aceita SELECT.");
  }

  const result = await executeQuery(query);
  return [new TextContent(JSON.stringify(result, null, 2))];
});


// ---- append_insight ----
server.tool.add({
  name: "append_insight",
  description: "Adiciona insight ao memo",
  inputSchema: {
    type: "object",
    properties: {
      insight: { type: "string" }
    },
    required: ["insight"]
  }
}, async ({ insight }) => {
  insights.push(insight);

  return [
    new TextContent("Insight added."),
    new EmbeddedResource("memo://insights")
  ];
});


// ===============================================================
// 📝 5. Prompts — exemplo completo
// ===============================================================
server.prompt.list(async () => {
  return [
    {
      name: "mcp-demo",
      description: "Demonstração MariaDB MCP",
      arguments: [
        {
          name: "topic",
          description: "Assunto do cenário",
          required: true
        } satisfies PromptArgument
      ]
    } satisfies Prompt
  ];
});

server.prompt.get(async ({ name, arguments: args }) => {
  if (name !== "mcp-demo") throw new Error("Prompt desconhecido.");

  const topic = args?.topic ?? "undefined topic";

  const message = `
Você iniciou uma demo MCP com o tema: ${topic}

Vamos explorar ferramentas, recursos e executar queries no seu MariaDB!
  `.trim();

  return {
    description: "MariaDB MCP demo",
    messages: [
      new PromptMessage("user", new TextContent(message))
    ]
  } satisfies GetPromptResult;
});


// ===============================================================
// 🚀 6. Servidor HTTP (recomendado pelo Agent Builder)
// ===============================================================
const port = Number(process.env.MCP_PORT ?? 7777);

createServer((req, res) => server.httpHandler(req, res))
  .listen(port, () => {
    console.log(`🚀 MCP Server rodando em http://localhost:${port}`);
  });

# PalpiteFC - Servidor MCP

Este é o servidor do Model Context Protocol (MCP) para o projeto PalpiteFC. Ele expõe ferramentas para que modelos de linguagem possam interagir com o banco de dados da aplicação.

## Estrutura do Projeto

```
palpitefc-mcp/
├─ package.json
├─ .env.example
├─ src/
│ ├─ index.js # entrypoint (inicia http server)
│ ├─ config/
│ │ └─ db.js # pool mysql
│ ├─ mcp/
│ │ ├─ server.js # cria McpServer e registra ferramentas
│ │ └─ tools/
│ │ └─ getMonthTopUser.js
│ ├─ http/
│ │ └─ server.js # http server + auth middleware + logging
│ └─ utils/
│ └─ logger.js # logger simples (console JSON)
└─ README.md
```

## Configuração

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Configure as variáveis de ambiente:**
    Crie um arquivo \`.env\` na raiz do projeto, copiando o conteúdo de \`.env.example\` e preenchendo com suas credenciais.

3.  **Execute o servidor:**
    ```bash
    npm start
    ```

## Ferramentas MCP

As ferramentas disponíveis são registradas em \`src/mcp/server.js\`.

*   **\`get-month-top-user\`**: Retorna o usuário com maior pontuação no mês.
```

module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
    'plugin:prettier/recommended' // Adiciona o Prettier
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Permite console.log e console.error
    'no-console': 'off',
    // Permite o uso de snake_case para nomes de variáveis (comum em SQL/DB)
    'camelcase': 'off',
    // Permite que funções assíncronas não tenham await (ex: para compatibilidade com o SDK)
    'require-await': 'off',
    // Permite que o SDK do MCP use a sintaxe de arrow function para o tool
    'arrow-body-style': 'off',
    // Permite que o SDK do MCP use a sintaxe de arrow function para o tool
    'prefer-arrow-callback': 'off',
    // Permite que o SDK do MCP use a sintaxe de arrow function para o tool
    'func-names': 'off',
    // Permite que o SDK do MCP use a sintaxe de arrow function para o tool
    'import/extensions': ['error', 'always', {
      js: 'always',
    }],
  },
};

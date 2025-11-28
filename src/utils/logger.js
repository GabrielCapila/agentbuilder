// src/utils/logger.js

/**
 * Logger simples que imprime mensagens no console em formato JSON.
 * @param {string} level - O nível do log (e.g., 'info', 'error').
 * @param {string} message - A mensagem principal do log.
 * @param {object} [data={}] - Dados adicionais para incluir no log.
 */
const logger = (level, message, data = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
};

// O código original usava console.log diretamente com strings,
// vou criar funções de atalho para simular o uso original e facilitar a refatoração.

export const info = (message, data) => logger('info', message, data);
export const error = (message, data) => logger('error', message, data);

// Exporta o logger principal para uso em outros módulos
export default logger;

// src/config/db.js
import mysql from 'mysql2/promise';
import { info, error } from '../utils/logger.js';

// O código original para o pool de conexão
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

// Teste de conexão simples
pool
  .getConnection()
  .then((connection) => {
    info('Conexão com o banco de dados estabelecida com sucesso.', {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
    });
    connection.release();
  })
  .catch((err) => {
    error('Falha ao conectar ao banco de dados.', {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      error: err.message,
    });
    // Em um ambiente de produção, você pode querer encerrar o processo aqui
    // process.exit(1);
  });

export default pool;

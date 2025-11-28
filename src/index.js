// src/index.js
import 'dotenv/config';
import { startServer } from './http/server.js';
import './config/db.js'; // Importa para inicializar o pool de conexão e testar a conexão

// Inicia o servidor HTTP
startServer();

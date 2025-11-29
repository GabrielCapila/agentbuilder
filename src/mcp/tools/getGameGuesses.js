// src/mcp/tools/getGameGuesses.js
import { z } from 'zod';
import pool from '../../config/db.js';
import { error } from '../../utils/logger.js';

// Definição da ferramenta
const getGameGuesses = {
  name: 'get-game-guesses',
  description: 'Retorna os palpites feitos para um jogo específico.',
  schema: {
    teamName: z.string().min(1),
    date: z.string().min(10), // formato esperado: 'YYYY-MM-DD'
  },
  handler: async ({ teamName, date }) => {
    try {
      // Busca o fixture (jogo) pelo nome da partida e data na tabela fixtures
      const fixtureSql = `
        SELECT id, name, start
        FROM fixtures
        WHERE name LIKE ?
          AND DATE(start) = ?
        LIMIT 1
      `;
      const [fixtureRows] = await pool.query(fixtureSql, [`%${teamName}%`, date]);
      const fixture = fixtureRows?.[0];
      if (!fixture) {
        return {
          content: [{ type: 'text', text: `Nenhum jogo encontrado com '${teamName}' na data ${date}.` }],
        };
      }
      // Busca os palpites para o jogo encontrado
      const guessSql = `
        SELECT
          g.id AS guessId,
          g.userId,
          u.name AS userName,
          g.homeGoals,
          g.awayGoals,
          g.createdAt
        FROM guesses g
        JOIN users u ON u.id = g.userId
        WHERE g.fixtureId = ?
        ORDER BY g.createdAt ASC
      `;
      const [guessRows] = await pool.query(guessSql, [fixture.id]);
      return {
        content: [
          {
            type: 'json',
            json: guessRows,
          },
        ],
      };
    } catch (err) {
      error('ERRO get-game-guesses:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar palpites.' }],
      };
    }
  },
};

export default getGameGuesses;

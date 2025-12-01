// src/mcp/tools/getGameGuesses.js
import { z } from 'zod';
import pool from '../../config/db.js';
import { error } from '../../utils/logger.js';
import { text } from 'stream/consumers';

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
            // Busca todas as informações agregadas dos palpites desse fixture
            const sql = `SELECT
              f.id AS fixtureId,
              f.name AS matchName,
              f.start AS matchDateTime,
              COUNT(g.id) AS guessesCount,
              JSON_ARRAYAGG(JSON_OBJECT(
                'guessId', g.id,
                'userId', g.userId,
                'userName', u.name,
                'homeGoals', g.homeGoals,
                'awayGoals', g.awayGoals,
                'createdAt', g.createdAt
              )) AS guesses
            FROM fixtures f
            LEFT JOIN guesses g ON g.fixtureId = f.id
            LEFT JOIN users u ON u.id = g.userId
            WHERE f.id = ?
            GROUP BY f.id, f.name, f.start
            LIMIT 1`;
            const [rows] = await pool.query(sql, [fixture.id]);
            if (!rows.length) {
              return {
                content: [{ type: 'text', text: 'Nenhum palpite encontrado para este jogo.' }],
              };
            }
            const result = rows[0];
            // Monta texto legível
            let text = `Jogo: ${result.matchName}\nData/Hora: ${result.matchDateTime}\nTotal de palpites: ${result.guessesCount}\n`;
            const guessesArr = result.guesses ? JSON.parse(result.guesses) : [];
            if (guessesArr.length) {
              text += '\nPalpites:';
              guessesArr.forEach((g, idx) => {
                text += `\n${idx + 1}. ${g.userName} (${g.userId}): ${g.homeGoals} x ${g.awayGoals} às ${g.createdAt}`;
              });
            } else {
              text += '\nNenhum palpite registrado.';
            }
            return {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
            };
          }
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

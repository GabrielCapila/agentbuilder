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
    date: z.string().min(10).optional(), // formato esperado: 'YYYY-MM-DD', opcional
  },
  handler: async ({ teamName, date }) => {
    try {
      // Considera o fuso horário do Brasil (UTC-3)
      const now = new Date();
      const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
      const brDateStr = brNow.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      let fixtureSql, params;
      if (date) {
        fixtureSql = `
          SELECT id, name, start
          FROM fixtures
          WHERE name LIKE ? AND DATE(start) = ?
          LIMIT 1
        `;
        params = [`%${teamName}%`, date];
      } else {
        fixtureSql = `
          SELECT id, name, start
          FROM fixtures
          WHERE name LIKE ? AND start >= ?
          ORDER BY start ASC
          LIMIT 1
        `;
        params = [`%${teamName}%`, `${brDateStr} 00:00:00`];
      }
      const [fixtureRows] = await pool.query(fixtureSql, params);
      const fixture = fixtureRows?.[0];
      if (!fixture) {
        return {
          content: [{ type: 'text', text: `Nenhum jogo encontrado com '${teamName}'${date ? ' na data ' + date : ' a partir de hoje'}.` }],
        };
      }
          // Busca todos os palpites desse fixture, agregando número de palpites e detalhes
          const sql = `SELECT
            f.id AS fixtureId,
            f.name AS matchName,
            f.start AS matchDateTime,
            COUNT(g.id) AS guessesCount,
            JSON_ARRAYAGG(JSON_OBJECT(
              'guessId', g.id,
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
              text += `\n${idx + 1}.  ${g.homeGoals} x ${g.awayGoals}`;
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

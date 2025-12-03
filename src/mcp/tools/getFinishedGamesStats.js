// src/mcp/tools/getFinishedGamesStats.js
import pool from '../../config/db.js';
import { z } from 'zod';
import { error } from '../../utils/logger.js';

const getFinishedGamesStats = {
  name: 'get-finished-games-stats',
  description: 'Retorna análise de jogos finalizados, incluindo placar, liga, número de palpites e número de palpites exatos.',
  schema: {
    limit: z.number().int().min(1).max(10).optional(),
  },
  handler: async ({ limit }) => {
    try {
      // Considera o fuso horário do Brasil (UTC-3)
      const now = new Date();
      const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
      const brDateStr = brNow.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const sql = `
        SELECT
            f.id AS fixtureId,
            f.name AS matchName,
            f.start AS matchDateTime,
            m.homeGoals,
          m.awayGoals,
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
          JOIN matches m ON m.fixtureId = f.id 
        JOIN teams t1 ON t1.id = m.homeId 
        JOIN teams t2 ON t2.id = m.awayId
        JOIN leagues c ON c.id = f.leagueId
          WHERE f.finished = 1 AND f.start < '2025-12-02 08:59:00'
          GROUP BY f.id, t1.name, t2.name, f.start, c.name, m.homeGoals, m.awayGoals
        	ORDER BY f.start DESC
        LIMIT ?
      `;
      const params = [brDateStr + ' 23:59:59', limit || 5];
      const [rows] = await pool.query(sql, params);
      if (!rows.length) {
        return {
          content: [{ type: 'text', text: 'Nenhum jogo finalizado encontrado.' }],
        };
      }
      let text = '';
      rows.forEach((row, idx) => {
        text += `Jogo ${idx + 1}: ${row.matchName}\n`;
        text += `Data/Hora: ${row.matchDateTime}\n`;
        text += `Placar final: ${row.homeGoals} x ${row.awayGoals}\n`;
        text += `Total de palpites: ${row.guessesCount}\n`;
        if (row.guesses) {
          text += `Palpites:\n`;
          let guessesArr;
          try {
            guessesArr = typeof row.guesses === 'string' ? JSON.parse(row.guesses) : row.guesses;
          } catch (e) {
            guessesArr = [];
            text += `  [Erro ao processar palpites]\n`;
          }
          if (Array.isArray(guessesArr)) {
            let idxGuess = 1;
            for (const g of guessesArr) {
              text += `  ${idxGuess++}. ${g.homeGoals} x ${g.awayGoals} (id: ${g.guessId}, criado em: ${g.createdAt})\n`;
            }
          }
        }
        text += `\n`;
      });
      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    } catch (err) {
      error('ERRO get-finished-games-stats:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar jogos finalizados.' }],
      };
    }
  },
};

export default getFinishedGamesStats;

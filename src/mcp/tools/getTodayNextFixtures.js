// src/mcp/tools/getTodayNextFixtures.js
import pool from '../../config/db.js';
import { z } from 'zod';
import { error } from '../../utils/logger.js';

const getTodayNextFixtures = {
  name: 'get-today-next-fixtures',
  description: 'Retorna os próximos 5 jogos do dia de hoje, com quantidade de palpites e detalhes dos palpites de cada jogo.',
  schema: {},
  handler: async () => {
    try {
      // Considera o fuso horário do Brasil (UTC-3) e busca os próximos 5 jogos a partir de agora
      const now = new Date();
      const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
      // Busca jogos a partir do horário atual do Brasil
      const brNowStr = brNow.toISOString().slice(0, 19).replace('T', ' ');
      const sql = `
        SELECT
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
        WHERE f.start > ?
        GROUP BY f.id, f.name, f.start
        ORDER BY f.start ASC
        LIMIT 5
      `;
      const [rows] = await pool.query(sql, [brNowStr]);
      if (!rows.length) {
        return {
          content: [{ type: 'text', text: 'Nenhum jogo futuro encontrado para hoje.' }],
        };
      }
      // Formata o retorno como texto legível
      let text = '';
      rows.forEach((row, idx) => {
        text += `Jogo ${idx + 1}: ${row.matchName}\nData/Hora: ${row.matchDateTime}\nTotal de palpites: ${row.guessesCount}\n`;
        const guessesArr = row.guesses ? JSON.parse(row.guesses) : [];
        if (guessesArr.length) {
          text += 'Palpites:';
          guessesArr.forEach((g, i) => {
            text += `\n  ${i + 1}. ${g.homeGoals} x ${g.awayGoals}`;
          });
        } else {
          text += 'Nenhum palpite registrado.';
        }
        text += '\n\n';
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
      error('ERRO get-today-next-fixtures:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar próximos jogos.' }],
      };
    }
  },
};

export default getTodayNextFixtures;

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
      // Ajusta guesses para array vazio se não houver palpites
      const results = rows.map(row => ({
        fixtureId: row.fixtureId,
        matchName: row.matchName,
        matchDateTime: row.matchDateTime,
        guessesCount: row.guessesCount,
        guesses: row.guesses ? JSON.parse(row.guesses) : [],
      }));
      return {
        content: 
          {
            type: 'json',
            json: JSON.stringify(results, null, 2)
          },
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

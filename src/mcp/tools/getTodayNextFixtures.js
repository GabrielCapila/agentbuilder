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
      // Novo select com join em teams e agregações para stats e mostGuessedScores
      const sql = `
        SELECT
          f.id AS id,
          t1.name AS home,
          t2.name AS away,
          f.start AS date,
          c.name AS championship,
          COUNT(g.id) AS guesses,
          JSON_ARRAYAGG(JSON_OBJECT(
            'homeGoals', g.homeGoals,
            'awayGoals', g.awayGoals
          )) AS guessesArr
        FROM fixtures f
        JOIN teams t1 ON t1.id = f.homeId
        JOIN teams t2 ON t2.id = f.awayId
        JOIN championships c ON c.id = f.leagueId
        LEFT JOIN guesses g ON g.fixtureId = f.id
        WHERE f.start > ?
        GROUP BY f.id, t1.name, t2.name, f.start, c.name
        ORDER BY f.start ASC
        LIMIT 5
      `;
      const [rows] = await pool.query(sql, [brNowStr]);
      if (!rows.length) {
        return {
          content: [{ type: 'json', json: { name: 'update_upcoming_games', params: { games: [] } } }],
        };
      }
      // Processa agregações para cada jogo
      const games = rows.map(row => {
        const guessesArr = row.guessesArr ? JSON.parse(row.guessesArr) : [];
        // Média de placar
        let avgHome = 0, avgAway = 0;
        if (guessesArr.length) {
          avgHome = Math.round(guessesArr.reduce((acc, g) => acc + (g.homeGoals || 0), 0) / guessesArr.length);
          avgAway = Math.round(guessesArr.reduce((acc, g) => acc + (g.awayGoals || 0), 0) / guessesArr.length);
        }
        // Estatísticas de resultado
        let vitHome = 0, empate = 0, vitAway = 0;
        const scoreMap = {};
        guessesArr.forEach(g => {
          if (g.homeGoals > g.awayGoals) vitHome++;
          else if (g.homeGoals < g.awayGoals) vitAway++;
          else empate++;
          const scoreStr = `${g.homeGoals} x ${g.awayGoals}`;
          scoreMap[scoreStr] = (scoreMap[scoreStr] || 0) + 1;
        });
        // Placar mais apostado
        const mostGuessedScores = Object.entries(scoreMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([score, count]) => ({ score, count }));
        return {
          id: row.id,
          home: row.home,
          away: row.away,
          date: row.date,
          championship: row.championship,
          guesses: row.guesses,
          avgScore: `${avgHome} x ${avgAway}`,
          stats: [
            { label: `Vitória ${row.home}`, value: vitHome },
            { label: 'Empate', value: empate },
            { label: `Vitória ${row.away}`, value: vitAway }
          ],
          mostGuessedScores
        };
      });
      // Monta string conforme o modelo solicitado
      let text = 'update_upcoming_games\n';
      games.forEach(game => {
        text += `\nJogo: ${game.home} x ${game.away}\n`;
        text += `Data: ${game.date}\nCampeonato: ${game.championship}\n`;
        text += `Palpites: ${game.guesses}\nMédia de placar: ${game.avgScore}\n`;
        text += 'Estatísticas:\n';
        game.stats.forEach(stat => {
          text += `  - ${stat.label}: ${stat.value}\n`;
        });
        text += 'Placar mais apostado:\n';
        game.mostGuessedScores.forEach(ms => {
          text += `  - ${ms.score}: ${ms.count}\n`;
        });
        text += '\n';
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

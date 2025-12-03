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
    teamName: z.string().min(1)
  },
  handler: async ({ teamName }) => {
    try {
      // Considera o fuso horário do Brasil (UTC-3)
      const now = new Date();
      const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
      const brNowStr = brNow.toISOString().slice(0, 19).replace('T', ' ');
      // Busca o próximo jogo futuro entre dois times
      const fixtureSql = `
        SELECT f.id, t1.name AS home, t2.name AS away, f.start AS date, c.name AS championship
        FROM fixtures f
        JOIN teams t1 ON t1.id = f.homeId
        JOIN teams t2 ON t2.id = f.awayId
        JOIN championships c ON c.id = f.leagueId
        WHERE t1.name = ? AND t2.name = ? AND f.start > ?
        ORDER BY f.start ASC
        LIMIT 1
      `;
      const [fixtureRows] = await pool.query(fixtureSql, [teamName.split(' x ')[0], teamName.split(' x ')[1], brNowStr]);
      const fixture = fixtureRows?.[0];
      if (!fixture) {
        return {
          content: [{ type: 'text', text: `Nenhum jogo futuro encontrado entre '${teamName}'.` }],
        };
      }
      // Busca os palpites e estatísticas desse jogo
      const statsSql = `
        SELECT
          COUNT(g.id) AS guesses,
          JSON_ARRAYAGG(JSON_OBJECT(
            'homeGoals', g.homeGoals,
            'awayGoals', g.awayGoals
          )) AS guessesArr
        FROM guesses g
        WHERE g.fixtureId = ?
      `;
      const [statsRows] = await pool.query(statsSql, [fixture.id]);
      const guesses = statsRows[0]?.guesses || 0;
      const guessesArr = statsRows[0]?.guessesArr ? JSON.parse(statsRows[0].guessesArr) : [];
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
      // Monta string conforme o modelo solicitado
      let text = `Jogo: ${fixture.home} x ${fixture.away}\n`;
      text += `Data: ${fixture.date}\nCampeonato: ${fixture.championship}\n`;
      text += `Palpites: ${guesses}\nMédia de placar: ${avgHome} x ${avgAway}\n`;
      text += 'Estatísticas:\n';
      text += `  - Vitória ${fixture.home}: ${vitHome}\n`;
      text += `  - Empate: ${empate}\n`;
      text += `  - Vitória ${fixture.away}: ${vitAway}\n`;
      text += 'Placar mais apostado:\n';
      mostGuessedScores.forEach(ms => {
        text += `  - ${ms.score}: ${ms.count}\n`;
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
      error('ERRO get-game-guesses:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar palpites.' }],
      };
    }
  },
};

export default getGameGuesses;

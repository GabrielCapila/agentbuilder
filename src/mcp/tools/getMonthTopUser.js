// src/mcp/tools/getMonthTopUser.js
import { z } from 'zod';
import pool from '../../config/db.js';
import { error } from '../../utils/logger.js';

// Definição da ferramenta
const getMonthTopUser = {
  name: 'get-month-top-user',
  description: 'Retorna o usuário com maior pontuação no mês.',
  schema: {
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(1970).max(9999).optional(),
  },
  handler: async ({ month, year }) => {
    try {
      const now = new Date();
      const y = year ?? now.getFullYear();
      const m = month ?? now.getMonth() + 1;

      // Calcula o início do mês atual e o início do próximo mês
      const startStr = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? y + 1 : y;
      const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

      const sql = `
        SELECT
          u.id AS userId,
          u.name AS name,
          u.email AS email,
          SUM(p.points) AS total_points
        FROM userPoints p
        JOIN users u ON u.id = p.userId
        WHERE p.createdAt >= ? AND p.createdAt < ?
        GROUP BY u.id, u.name, u.email
        ORDER BY total_points DESC
        LIMIT 1
      `;

      const [rows] = await pool.query(sql, [startStr, endStr]);
      const top = rows?.[0];

      return {
        content: [
          {
            type: 'text',
            text: top
              ? `Top de ${m}/${y}: ${top.name} (${top.email}) com ${top.total_points} pontos.`
              : `Nenhum ponto encontrado em ${m}/${y}.`,
          },
          // O código original tinha um JSON comentado, vou deixar o JSON como opção
          // {
          //   type: 'json',
          //   json: { month: m, year: y, topUser: top }
          // }
        ],
      };
    } catch (err) {
      error('ERRO get-month-top-user:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Erro ao consultar ranking.' }],
      };
    }
  },
};

export default getMonthTopUser;

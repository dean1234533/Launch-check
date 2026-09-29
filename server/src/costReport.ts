// Prints what the AI has actually cost so far: `npm run costs`.
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

const db = openDb(loadConfig().databasePath);
const rows = db
  .prepare(
    `SELECT kind, COUNT(*) AS calls, AVG(cost_usd) AS avg, MAX(cost_usd) AS max, SUM(cost_usd) AS total,
            AVG(input_tokens + cache_read_tokens + cache_write_tokens) AS avg_in, AVG(output_tokens) AS avg_out
     FROM ai_calls GROUP BY kind`,
  )
  .all() as Array<{ kind: string; calls: number; avg: number; max: number; total: number; avg_in: number; avg_out: number }>;

if (!rows.length) console.log("No AI calls recorded yet.");
for (const r of rows) {
  console.log(
    `${r.kind}: ${r.calls} calls | avg $${r.avg.toFixed(3)} | max $${r.max.toFixed(3)} | total $${r.total.toFixed(2)} | avg tokens in ${Math.round(r.avg_in)} / out ${Math.round(r.avg_out)}`,
  );
}
const perUser = db
  .prepare(
    `SELECT u.login, SUM(a.cost_usd) AS total FROM ai_calls a JOIN users u ON u.github_id = a.github_id
     GROUP BY a.github_id ORDER BY total DESC LIMIT 10`,
  )
  .all() as Array<{ login: string; total: number }>;
if (perUser.length) console.log("\nTop users by AI cost:\n" + perUser.map((u) => `  ${u.login}: $${u.total.toFixed(2)}`).join("\n"));

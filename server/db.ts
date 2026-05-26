import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "[db] DATABASE_URL is not set — server will start but DB queries will fail until it's configured.",
  );
} else {
  try {
    const u = new URL(connectionString);
    const pwd = decodeURIComponent(u.password);
    console.log("[db] connection target:", {
      host: u.hostname,
      port: u.port || "default",
      user: decodeURIComponent(u.username),
      passwordLength: pwd.length,
      passwordStartsWith: pwd.slice(0, 1),
      passwordEndsWith: pwd.slice(-1),
      passwordHasBrackets: pwd.includes("[") || pwd.includes("]"),
      database: u.pathname.slice(1),
    });
  } catch (e) {
    console.error("[db] DATABASE_URL is not a valid URL:", (e as Error).message);
  }
}

// Supabase (and most managed Postgres) require SSL. If the user's connection
// string didn't pin sslmode, force it on — node-postgres defaults to no SSL.
const needsSsl =
  !!connectionString &&
  !/sslmode=/.test(connectionString) &&
  !/localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
export { schema };

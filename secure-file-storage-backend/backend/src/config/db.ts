import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  // Unexpected error on idle client - log and let the process supervisor restart if needed.
  console.error("Unexpected PostgreSQL pool error", err);
});

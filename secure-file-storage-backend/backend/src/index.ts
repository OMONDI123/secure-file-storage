import app from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";

async function start() {
  // Fail fast if the database is unreachable rather than serving broken requests.
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL. Did you run `npm run migrate`?", err);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`Secure File Storage API listening on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

start();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./data/schema/*.ts",
  out: "./data/migrations",
  dbCredentials: {
    url: process.env.DB_URL ?? "file:./sarthi.dev.db",
  },
});

import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://diary:diary@localhost:5432/diary";
const globalDb = globalThis as unknown as {sql?: ReturnType<typeof postgres>};
const sql = globalDb.sql ?? postgres(url, {max: 10});
if (process.env.NODE_ENV !== "production") globalDb.sql = sql;

export const db = drizzle(sql, {schema});

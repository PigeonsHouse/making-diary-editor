import { index, jsonb, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Character, ProjectDocument } from "@/domain/types";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  revision: integer("revision").notNull().default(1),
  name: text("name").notNull(),
  document: jsonb("document").$type<ProjectDocument>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey(),
  revision: integer("revision").notNull().default(1),
  data: jsonb("data").$type<Character>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    originalName: text("original_name").notNull(),
    originalPath: text("original_path").notNull(),
    normalizedPath: text("normalized_path"),
    status: text("status").notNull().default("processing"),
    defaultVolume: real("default_volume").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assets_project_id_idx").on(table.projectId)],
);

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  status: text("status").notNull().default("queued"),
  progress: real("progress").notNull().default(0),
  etaMs: integer("eta_ms"),
  snapshot: jsonb("snapshot").$type<ProjectDocument>().notNull(),
  outputPath: text("output_path"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});

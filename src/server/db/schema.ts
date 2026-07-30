import {jsonb, integer, pgTable, text, timestamp, uuid} from "drizzle-orm/pg-core";
import type {Character, ProjectDocument} from "@/domain/types";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  revision: integer("revision").notNull().default(1),
  name: text("name").notNull(),
  document: jsonb("document").$type<ProjectDocument>().notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey(),
  revision: integer("revision").notNull().default(1),
  data: jsonb("data").$type<Character>().notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  originalName: text("original_name").notNull(),
  originalPath: text("original_path").notNull(),
  normalizedPath: text("normalized_path"),
  status: text("status").notNull().default("processing"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
});

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  snapshot: jsonb("snapshot").$type<ProjectDocument>().notNull(),
  outputPath: text("output_path"),
  error: text("error"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});

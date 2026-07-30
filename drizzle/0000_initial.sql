CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "revision" integer NOT NULL DEFAULT 1,
  "name" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "characters" (
  "id" uuid PRIMARY KEY,
  "revision" integer NOT NULL DEFAULT 1,
  "data" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "original_name" text NOT NULL,
  "original_path" text NOT NULL,
  "normalized_path" text,
  "status" text NOT NULL DEFAULT 'processing',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "status" text NOT NULL DEFAULT 'queued',
  "progress" integer NOT NULL DEFAULT 0,
  "snapshot" jsonb NOT NULL,
  "output_path" text,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL
);

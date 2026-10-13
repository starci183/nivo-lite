import { sql } from "@modules/platform/database"

/** Snapshots the script and spec of a project version next to the render it started ($1 project, $2 workspace, $3 version, $4 script, $5 spec, $6 render, $7 creator). */
export const INSERT_PROJECT_VERSION = sql`INSERT INTO public.video_project_versions (project_id, workspace_id, version, script, spec, render_id, created_by)
VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`

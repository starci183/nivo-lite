import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import type { N8nHostOptions } from "@modules/integrations/n8n-host"
import { parseTemplateFilesConfig } from "@modules/integrations/template-files"
import type { TemplateFilesOptions } from "@modules/integrations/template-files"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the lite cli needs: the least-privilege Supabase PostgreSQL connection. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
    /** Where the shared n8n container runs, for `sync-n8n`. */
    readonly n8nHost: N8nHostOptions
    /** The folder of the automation definition files, for `seed-automations` and `sync-n8n`. */
    readonly templateFiles: TemplateFilesOptions
}

/** Reads the one declared connection without adding entities or TypeORM migrations. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    templateFiles: parseTemplateFilesConfig(env),
})

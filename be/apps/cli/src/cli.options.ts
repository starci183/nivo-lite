import { parseLlmConfig } from "@modules/integrations/llm"
import type { LlmOptions } from "@modules/integrations/llm"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the lite cli needs: the Supabase PostgreSQL connection and the Supabase project it administers. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
    /** Supabase Auth administration, used by the demo-workspace seed. */
    readonly supabase: SupabaseOptions
    /** The model provider the base knowledge is embedded with. */
    readonly llm: LlmOptions
}

/** Reads the one declared connection without adding entities or TypeORM migrations, and the Supabase project. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
})

import { parseLlmConfig } from "@modules/integrations/llm"
import type { LlmOptions } from "@modules/integrations/llm"
import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import type { N8nHostOptions } from "@modules/integrations/n8n-host"
import { parseTemplateFilesConfig } from "@modules/integrations/template-files"
import type { TemplateFilesOptions } from "@modules/integrations/template-files"
import { parseSepaySimulationConfig } from "@modules/domain/sepay-simulation"
import type { SepaySimulationOptions } from "@modules/domain/sepay-simulation"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** How long the simulated delivery waits for the api. */
const SIMULATION_TIMEOUT_MS = 15_000

/** Everything the lite cli needs: the Supabase PostgreSQL connection and the Supabase project it administers. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
    /** Where the shared n8n container runs, for `sync-n8n`. */
    readonly n8nHost: N8nHostOptions
    /** The folder of the automation definition files, for `seed-automations` and `sync-n8n`. */
    readonly templateFiles: TemplateFilesOptions
    /** Supabase Auth administration, used by the demo-workspace seed. */
    readonly supabase: SupabaseOptions
    /** The model provider the base knowledge is embedded with. */
    readonly llm: LlmOptions
    /** The simulated SePay delivery of the simulate-sepay command. */
    readonly sepaySimulation: SepaySimulationOptions
}

/** Reads the one declared connection without adding entities or TypeORM migrations, and the Supabase project. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    templateFiles: parseTemplateFilesConfig(env),
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
    sepaySimulation: parseSepaySimulationConfig(
        env,
        async ({ url, headers, body }) => {
            const reply = await fetch(url, {
                method: "POST",
                headers: { ...headers },
                body,
                signal: AbortSignal.timeout(SIMULATION_TIMEOUT_MS),
            })
            return { status: reply.status, text: await reply.text() }
        },
        (line) => process.stdout.write(`${line}\n`),
    ),
})

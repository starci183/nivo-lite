import { homedir } from "node:os"
import { join } from "node:path"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CliModule } from "@features/cli"
import { AutomationTemplatesModule } from "@modules/domain/automation-templates"
import { N8nHostModule } from "@modules/integrations/n8n-host"
import { TemplateFilesModule } from "@modules/integrations/template-files"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { SepaySimulationModule } from "@modules/domain/sepay-simulation"
import { SeedSecretsFileClient, WorkspaceSeedModule } from "@modules/domain/workspace-seed"
import { SUPABASE_ACCOUNTS, SUPABASE_AUTH, SupabaseModule } from "@modules/integrations/supabase"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { CliAppOptions } from "./cli.options"

@Module({})
/**
 * The composition root of the cli: the clock and the logger every command logs through, the database capability over every
 * connection, Supabase Auth administration, the workspace capabilities (demo seed and prune) with the operator secrets file, and the cli feature root.
 */
export class AppModule {
    /** Builds the cli from its parsed options. */
    static register(options: CliAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: options.connections,
                }),
                TemplateFilesModule.register({ isGlobal: true, ...options.templateFiles }),
                AutomationTemplatesModule.register({ isGlobal: true }),
                N8nHostModule.register({ isGlobal: true, ...options.n8nHost }),
                SupabaseModule.register({ isGlobal: true, ...options.supabase }),
                WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
                WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: true }),
                WorkspaceSeedModule.register({
                    isGlobal: true,
                    auth: SUPABASE_ACCOUNTS,
                    secrets: new SeedSecretsFileClient(join(homedir(), ".nivo-lite", "secrets.env")),
                    print: (line) => process.stdout.write(`${line}\n`),
                }),
                AuthorityActionsModule.register({ isGlobal: true }),
                SepaySimulationModule.register({ isGlobal: true, ...options.sepaySimulation }),
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                CliModule,
            ],
        }
    }
}

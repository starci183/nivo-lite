import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CliModule } from "@features/cli"
import { AutomationTemplatesModule } from "@modules/domain/automation-templates"
import { N8nHostModule } from "@modules/integrations/n8n-host"
import { TemplateFilesModule } from "@modules/integrations/template-files"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { CliAppOptions } from "./cli.options"

@Module({})
/**
 * The composition root of the cli: the clock and the logger every command logs through, the database capability over every
 * connection with its entities and migrations, and the cli feature root.
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
                AuthorityActionsModule.register({ isGlobal: true }),
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                CliModule,
            ],
        }
    }
}

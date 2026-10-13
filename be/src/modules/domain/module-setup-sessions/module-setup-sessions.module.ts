import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-setup-sessions.module-definition"
import { SetupSessionsService } from "./setup-sessions.service"

@Module({})
/** The draft sessions of the setup chat of an installation, over the primary Supabase PostgreSQL connection. */
export class ModuleSetupSessionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SetupSessionsService],
            exports: [SetupSessionsService],
        }
    }
}

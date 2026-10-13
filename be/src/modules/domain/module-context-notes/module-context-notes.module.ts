import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ModuleSetupSessionsModule } from "@modules/domain/module-setup-sessions"
import { ContextNotesService } from "./context-notes.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-context-notes.module-definition"

@Module({})
/** Notes that supplement an installation's context, over the primary Supabase PostgreSQL connection. */
export class ContextNotesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ModuleSetupSessionsModule.register({})],
            providers: [...(base.providers ?? []), ContextNotesService],
            exports: [ContextNotesService],
        }
    }
}

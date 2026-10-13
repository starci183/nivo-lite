import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-context-versions.module-definition"
import { ContextVersionsService } from "./context-versions.service"

@Module({})
/** The immutable context versions a setup applies to an installation, over the primary Supabase PostgreSQL connection. */
export class ModuleContextVersionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContextVersionsService],
            exports: [ContextVersionsService],
        }
    }
}

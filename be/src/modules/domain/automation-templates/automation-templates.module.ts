import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationTemplatesService } from "./automation-templates.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-templates.module-definition"

@Module({})
/** The automation templates capability over the primary Supabase PostgreSQL connection. */
export class AutomationTemplatesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AutomationTemplatesService],
            exports: [AutomationTemplatesService],
        }
    }
}

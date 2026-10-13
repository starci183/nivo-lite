import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-settings.module-definition"
import { ContentSettingsService } from "./content-settings.service"

@Module({})
/** The content-settings capability over the primary Supabase PostgreSQL connection: which automations a workspace switched on and their dedupe marks. */
export class ContentSettingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentSettingsService],
            exports: [ContentSettingsService],
        }
    }
}

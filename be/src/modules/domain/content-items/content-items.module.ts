import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-items.module-definition"
import { ContentItemsService } from "./content-items.service"

@Module({})
/** The content-items capability over the primary Supabase PostgreSQL connection: the posts the content automations read and the ideas they write. */
export class ContentItemsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ContentItemsService], exports: [ContentItemsService] }
    }
}

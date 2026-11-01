import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content.module-definition"
import { ContentService } from "./content.service"

@Module({})
/** The content capability over the primary PostgreSQL connection: the scheduled content automations of the workspaces. */
export class ContentModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that runs the content tick. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ContentService], exports: [ContentService] }
    }
}

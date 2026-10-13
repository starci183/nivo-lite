import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-publishing.module-definition"
import { ContentPublishingService } from "./content-publishing.service"
import { PublishContentPerformerService } from "./publish-content-performer.service"

@Module({})
/** Composes the content item owner with the existing approval gate and workspace evidence log. */
export class ContentPublishingModule extends ConfigurableModuleClass {
    /** Registers publishing once at the API app root, alongside its existing capability owners. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentPublishingService, PublishContentPerformerService],
            exports: [ContentPublishingService],
        }
    }
}

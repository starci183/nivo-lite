import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CONTENT_MEDIA_STORAGE } from "./content-media.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-media.module-definition"
import { ContentMediaService } from "./content-media.service"

@Module({})
/** Workspace media listing, attachment addresses and upload authorization. */
export class ContentMediaModule extends ConfigurableModuleClass {
    /** Registers the storage binding and service once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CONTENT_MEDIA_STORAGE, useExisting: options.storage },
                ContentMediaService,
            ],
            exports: [ContentMediaService],
        }
    }
}

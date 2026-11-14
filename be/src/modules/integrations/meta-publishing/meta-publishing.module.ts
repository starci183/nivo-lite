import { Module, type DynamicModule } from "@nestjs/common"
import { MetaPublishingClient } from "./meta-publishing.client"
import { META_PUBLISHING } from "./meta-publishing.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-publishing.module-definition"

@Module({})
/** Provides the MetaPublishing client. */
export class MetaPublishingModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls MetaPublishing. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: META_PUBLISHING, useClass: MetaPublishingClient }],
            exports: [META_PUBLISHING],
        }
    }
}

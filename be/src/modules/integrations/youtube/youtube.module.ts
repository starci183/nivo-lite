import { Module, type DynamicModule } from "@nestjs/common"
import { YoutubeClient } from "./youtube.client"
import { YOUTUBE } from "./youtube.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./youtube.module-definition"

@Module({})
/** Provides the Youtube client. */
export class YoutubeModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Youtube. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: YOUTUBE, useClass: YoutubeClient }],
            exports: [YOUTUBE],
        }
    }
}

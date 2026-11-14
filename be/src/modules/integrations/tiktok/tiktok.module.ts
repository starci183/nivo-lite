import { Module, type DynamicModule } from "@nestjs/common"
import { TiktokClient } from "./tiktok.client"
import { TIKTOK } from "./tiktok.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tiktok.module-definition"

@Module({})
/** Provides the TikTok client. */
export class TiktokModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls TikTok. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: TIKTOK, useClass: TiktokClient }],
            exports: [TIKTOK],
        }
    }
}

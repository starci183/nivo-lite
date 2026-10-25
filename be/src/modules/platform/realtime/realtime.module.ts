import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./realtime.module-definition"
import { REALTIME_PUBLISHER } from "./realtime.decorators"
import { RealtimeService } from "./realtime.service"

@Module({})
/** The server's private Supabase Realtime broadcast capability. */
export class RealtimeModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: REALTIME_PUBLISHER, useClass: RealtimeService }],
            exports: [REALTIME_PUBLISHER],
        }
    }
}

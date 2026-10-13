import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ZaloClient } from "./zalo.client"
import { ZALO } from "./zalo.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo.module-definition"

@Module({})
/** Provides the Zalo client. */
export class ZaloModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that talks to Zalo. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: ZALO, useClass: ZaloClient }],
            exports: [ZALO],
        }
    }
}

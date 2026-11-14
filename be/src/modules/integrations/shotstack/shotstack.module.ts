import { Module, type DynamicModule } from "@nestjs/common"
import { ShotstackClient } from "./shotstack.client"
import { SHOTSTACK } from "./shotstack.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./shotstack.module-definition"

@Module({})
/** Provides the Shotstack client. */
export class ShotstackModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Shotstack. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: SHOTSTACK, useClass: ShotstackClient }],
            exports: [SHOTSTACK],
        }
    }
}

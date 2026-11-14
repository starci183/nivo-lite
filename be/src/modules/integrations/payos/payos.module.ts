import { Module, type DynamicModule } from "@nestjs/common"
import { PayosClient } from "./payos.client"
import { PAYOS } from "./payos.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payos.module-definition"

@Module({})
/** Provides the payOS client. */
export class PayosModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls payOS. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: PAYOS, useClass: PayosClient }],
            exports: [PAYOS],
        }
    }
}

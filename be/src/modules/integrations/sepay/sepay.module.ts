import { Module, type DynamicModule } from "@nestjs/common"
import { SepayClient } from "./sepay.client"
import { SEPAY } from "./sepay.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay.module-definition"

@Module({})
/** Provides the SePay client. */
export class SepayModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that reads SePay. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: SEPAY, useClass: SepayClient }],
            exports: [SEPAY],
        }
    }
}

import { Module, type DynamicModule } from "@nestjs/common"
import { MisaAmisClient } from "./misa-amis.client"
import { MISA_AMIS } from "./misa-amis.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./misa-amis.module-definition"

@Module({})
/** Provides the MisaAmis client. */
export class MisaAmisModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls MisaAmis. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: MISA_AMIS, useClass: MisaAmisClient }],
            exports: [MISA_AMIS],
        }
    }
}

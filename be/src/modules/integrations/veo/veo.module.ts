import { Module, type DynamicModule } from "@nestjs/common"
import { VeoClient } from "./veo.client"
import { VEO } from "./veo.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./veo.module-definition"

@Module({})
/** Provides the Veo client. */
export class VeoModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Veo. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: VEO, useClass: VeoClient }],
            exports: [VEO],
        }
    }
}

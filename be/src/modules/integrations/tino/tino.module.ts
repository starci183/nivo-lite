import { Module, type DynamicModule } from "@nestjs/common"
import { TinoClient } from "./tino.client"
import { TINO } from "./tino.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tino.module-definition"

@Module({})
/** Provides the Tino client. */
export class TinoModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Tino. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: TINO, useClass: TinoClient }],
            exports: [TINO],
        }
    }
}

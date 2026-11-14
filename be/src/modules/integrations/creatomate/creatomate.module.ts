import { Module, type DynamicModule } from "@nestjs/common"
import { CreatomateClient } from "./creatomate.client"
import { CREATOMATE } from "./creatomate.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./creatomate.module-definition"

@Module({})
/** Provides the Creatomate client. */
export class CreatomateModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Creatomate. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: CREATOMATE, useClass: CreatomateClient }],
            exports: [CREATOMATE],
        }
    }
}

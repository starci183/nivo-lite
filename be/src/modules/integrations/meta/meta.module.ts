import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MetaClient } from "./meta.client"
import { META_CLIENT } from "./meta.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta.module-definition"

@Module({})
/** Provides the meta client. */
export class MetaModule extends ConfigurableModuleClass {
    /** Registers the integration once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: META_CLIENT, useClass: MetaClient }],
            exports: [META_CLIENT],
        }
    }
}

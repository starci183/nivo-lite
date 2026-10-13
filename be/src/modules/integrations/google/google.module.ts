import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GoogleClient } from "./google.client"
import { GOOGLE_CLIENT } from "./google.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google.module-definition"

@Module({})
/** Provides the google client. */
export class GoogleModule extends ConfigurableModuleClass {
    /** Registers the integration once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: GOOGLE_CLIENT, useClass: GoogleClient }],
            exports: [GOOGLE_CLIENT],
        }
    }
}

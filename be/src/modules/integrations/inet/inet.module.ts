import { Module, type DynamicModule } from "@nestjs/common"
import { InetClient } from "./inet.client"
import { INET } from "./inet.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inet.module-definition"

@Module({})
/** Provides the iNET client. */
export class InetModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls iNET. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: INET, useClass: InetClient }],
            exports: [INET],
        }
    }
}

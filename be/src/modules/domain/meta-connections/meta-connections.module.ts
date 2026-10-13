import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MetaConnectionsService } from "./meta-connections.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-connections.module-definition"

@Module({})
/** The Facebook Pages and Instagram connection wizard over the connections capability. */
export class MetaConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), MetaConnectionsService],
            exports: [MetaConnectionsService],
        }
    }
}

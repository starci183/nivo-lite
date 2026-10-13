import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connector-interest.module-definition"
import { ConnectorInterestService } from "./connector-interest.service"

@Module({})
/** The connectors the owners asked for that NIVO does not offer yet. */
export class ConnectorInterestModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConnectorInterestService],
            exports: [ConnectorInterestService],
        }
    }
}

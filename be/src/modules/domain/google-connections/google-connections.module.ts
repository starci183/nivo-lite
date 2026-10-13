import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GoogleConnectionsService } from "./google-connections.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-connections.module-definition"

@Module({})
/** The Google account connections and the orders spreadsheet automation over the connections capability. */
export class GoogleConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), GoogleConnectionsService],
            exports: [GoogleConnectionsService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-commands.module-definition"
import { ConnectionCommandsService } from "./connection-commands.service"

@Module({})
/** The console commands a signed-in member submits through the database and the back end runs for them. */
export class ConnectionCommandsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConnectionCommandsService],
            exports: [ConnectionCommandsService],
        }
    }
}

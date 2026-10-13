import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./app-commands.module-definition"
import { AppCommandsService } from "./app-commands.service"

@Module({})
/** The commands the web app asks of the back end through the database, over the primary connection. */
export class AppCommandsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AppCommandsService],
            exports: [AppCommandsService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-setup-messages.module-definition"
import { SetupMessagesService } from "./setup-messages.service"

@Module({})
/** The messages of the setup chat of an installation, over the primary PostgreSQL connection. */
export class ModuleSetupMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), options.sessions],
            providers: [...(base.providers ?? []), SetupMessagesService],
            exports: [SetupMessagesService],
        }
    }
}

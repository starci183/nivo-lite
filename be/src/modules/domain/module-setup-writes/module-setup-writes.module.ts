import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-setup-writes.module-definition"
import { SetupWritesService } from "./setup-writes.service"

@Module({})
/** The confirm cards the setup chat proposes, over the primary PostgreSQL connection. */
export class ModuleSetupWritesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), SetupWritesService], exports: [SetupWritesService] }
    }
}

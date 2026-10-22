import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CHAIN_OWNER_DIRECTORY } from "./work-chains.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-chains.module-definition"
import { WorkChainsService } from "./work-chains.service"

@Module({})
/** The steps of a work chain, its summary and its limits. The owner directory is bound by the app root through the options. */
export class WorkChainsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CHAIN_OWNER_DIRECTORY, useExisting: options.ownerDirectory },
                WorkChainsService,
            ],
            exports: [WorkChainsService],
        }
    }
}

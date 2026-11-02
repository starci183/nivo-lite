import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { IntentRegistryService } from "./intent-registry.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./intent-contracts.module-definition"

@Module({})
/**
 * The registry of the intents a turn can pick from. It holds no domain: each capability that owns intents registers its frames, the
 * schema of each result and the function of each check when its module starts, the way the handlers of a wake source register.
 */
export class IntentContractsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), IntentRegistryService],
            exports: [IntentRegistryService],
        }
    }
}

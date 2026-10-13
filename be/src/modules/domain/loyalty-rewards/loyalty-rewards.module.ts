import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyRewardsService } from "./loyalty-rewards.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-rewards.module-definition"

@Module({})
/** The loyalty rewards capability: the catalogue and its stock. */
export class LoyaltyRewardsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LoyaltyRewardsService],
            exports: [LoyaltyRewardsService],
        }
    }
}

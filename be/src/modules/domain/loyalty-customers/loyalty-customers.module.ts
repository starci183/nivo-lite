import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyCustomersService } from "./loyalty-customers.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-customers.module-definition"

@Module({})
/** The loyalty customers capability: the people of the programme and their tier. */
export class LoyaltyCustomersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LoyaltyCustomersService],
            exports: [LoyaltyCustomersService],
        }
    }
}

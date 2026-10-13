import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyCustomerLinksService } from "./loyalty-customer-links.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-customer-links.module-definition"

@Module({})
/** The loyalty customer links capability: which leads, conversations and chat accounts belong to which customer. */
export class LoyaltyCustomerLinksModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LoyaltyCustomerLinksService],
            exports: [LoyaltyCustomerLinksService],
        }
    }
}

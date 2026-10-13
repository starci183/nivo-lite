import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyApiService } from "./loyalty-api.service"
import { LoyaltyCommandsService } from "./loyalty-commands.service"
import { LoyaltyEarningService } from "./loyalty-earning.service"
import { LoyaltyMembersService } from "./loyalty-members.service"
import { LoyaltyOverviewService } from "./loyalty-overview.service"
import { LoyaltyPromotionsService } from "./loyalty-promotions.service"
import { LoyaltyPublicService } from "./loyalty-public.service"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"
import { LOYALTY_CODE_DELIVERY } from "./loyalty.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty.module-definition"

@Module({})
/** The loyalty programme: the owner's workbench, the public points check and the till API, over the capabilities that own each table. */
export class LoyaltyModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app, with the delivery of one-time codes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: LOYALTY_CODE_DELIVERY, useValue: options.delivery },
                LoyaltyOverviewService,
                LoyaltyRedemptionService,
                LoyaltyEarningService,
                LoyaltyMembersService,
                LoyaltyPromotionsService,
                LoyaltyPublicService,
                LoyaltyApiService,
                LoyaltyCommandsService,
            ],
            exports: [
                LoyaltyCommandsService,
                LoyaltyOverviewService,
                LoyaltyMembersService,
                LoyaltyPromotionsService,
                LoyaltyPublicService,
                LoyaltyApiService,
            ],
        }
    }
}

import { Module } from "@nestjs/common"
import { ListTillMembersHandler } from "./application/list-till-members.handler"
import { AwardTillPointsHandler } from "./application/award-till-points.handler"
import { RedeemTillRewardHandler } from "./application/redeem-till-reward.handler"
import { DraftTillPromoHandler } from "./application/draft-till-promo.handler"
import { ConfigurableModuleClass } from "./loyalty-till.module-definition"

@Module({
    providers: [ListTillMembersHandler, AwardTillPointsHandler, RedeemTillRewardHandler, DraftTillPromoHandler],
})
/** The loyalty-till feature: the handlers of its application. */
export class LoyaltyTillApiModule extends ConfigurableModuleClass {}

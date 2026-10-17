import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./loyalty-campaign.module-definition"
import { LoyaltyCampaignQueue } from "./loyalty-campaign.queue"

@Module({ providers: [LoyaltyCampaignQueue], exports: [LoyaltyCampaignQueue] })
/** The campaign draft queue's typed producer. */
export class LoyaltyCampaignQueueModule extends ConfigurableModuleClass {}

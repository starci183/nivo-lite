import { Module } from "@nestjs/common"
import { LoyaltyCampaignQueue } from "./loyalty-campaign.queue"

@Module({ providers: [LoyaltyCampaignQueue], exports: [LoyaltyCampaignQueue] })
/** The campaign draft queue's typed producer. */
export class LoyaltyCampaignQueueModule {}

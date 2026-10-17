import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./draft-loyalty-campaign.module-definition"
import { DraftLoyaltyCampaignStep } from "./steps/draft-loyalty-campaign.step"

@Module({ providers: [DraftLoyaltyCampaignStep], exports: [DraftLoyaltyCampaignStep] })
/** The campaign draft job's application step. */
export class DraftLoyaltyCampaignModule extends ConfigurableModuleClass {}

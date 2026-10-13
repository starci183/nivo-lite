import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"
import { LoyaltyCampaignQueueModule } from "@modules/queues/loyalty-campaign"
import { LoyaltyCampaignDraftsService } from "./loyalty-campaign-drafts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-campaigns.module-definition"

@Module({})
/** The loyalty campaigns capability: segments of customers and the draft of a promotion to them. */
export class LoyaltyCampaignsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), LoyaltyCampaignQueueModule],
            providers: [...(base.providers ?? []), LoyaltyCampaignsService, LoyaltyCampaignDraftsService],
            exports: [LoyaltyCampaignsService, LoyaltyCampaignDraftsService],
        }
    }
}

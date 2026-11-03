import { defineConfigurableModule } from "@starci/nest-kit"
import type { LoyaltyCampaignQueueOptions } from "./loyalty-campaign.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LoyaltyCampaignQueueOptions>()

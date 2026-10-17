import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyCampaignQueueOptions } from "./loyalty-campaign.options"

/** The configurable-module base of the loyalty-campaign module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LoyaltyCampaignQueueOptions>().setClassMethodName("register").build()

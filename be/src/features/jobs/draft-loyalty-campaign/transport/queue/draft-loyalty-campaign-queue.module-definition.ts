import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DraftLoyaltyCampaignQueueOptions } from "./draft-loyalty-campaign-queue.options"

/** The configurable-module base of the draft-loyalty-campaign-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DraftLoyaltyCampaignQueueOptions>().setClassMethodName("register").build()

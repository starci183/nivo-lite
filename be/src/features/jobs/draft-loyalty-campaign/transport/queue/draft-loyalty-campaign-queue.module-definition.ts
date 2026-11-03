import { defineConfigurableModule } from "@starci/nest-kit"
import type { DraftLoyaltyCampaignQueueOptions } from "./draft-loyalty-campaign-queue.options"

/** The configurable-module base of the draft-loyalty-campaign-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DraftLoyaltyCampaignQueueOptions>()

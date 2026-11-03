import { defineConfigurableModule } from "@starci/nest-kit"
import type { DraftLoyaltyCampaignOptions } from "./draft-loyalty-campaign.options"

/** The configurable-module base of the draft-loyalty-campaign module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DraftLoyaltyCampaignOptions>()

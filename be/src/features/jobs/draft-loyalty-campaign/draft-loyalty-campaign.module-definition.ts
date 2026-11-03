import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DraftLoyaltyCampaignOptions } from "./draft-loyalty-campaign.options"

type Host = ConfigurableModuleHost<DraftLoyaltyCampaignOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DraftLoyaltyCampaignOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the draft-loyalty-campaign module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the draft-loyalty-campaign module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the draft-loyalty-campaign module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

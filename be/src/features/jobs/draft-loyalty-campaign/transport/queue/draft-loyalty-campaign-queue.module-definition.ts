import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DraftLoyaltyCampaignQueueOptions } from "./draft-loyalty-campaign-queue.options"

type Host = ConfigurableModuleHost<DraftLoyaltyCampaignQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DraftLoyaltyCampaignQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the draft-loyalty-campaign-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the draft-loyalty-campaign-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the draft-loyalty-campaign-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

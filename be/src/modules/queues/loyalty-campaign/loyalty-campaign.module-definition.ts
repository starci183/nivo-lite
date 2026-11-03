import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyCampaignQueueOptions } from "./loyalty-campaign.options"

/** The configurable-module base of the loyalty-campaign module. */
const definition = new ConfigurableModuleBuilder<LoyaltyCampaignQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<LoyaltyCampaignQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: LoyaltyCampaignQueueOptions = definition.OPTIONS_TYPE

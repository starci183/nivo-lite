import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyCampaignsOptions } from "./loyalty-campaigns.options"

/** The configurable-module base of the loyalty-campaigns capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyCampaignsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

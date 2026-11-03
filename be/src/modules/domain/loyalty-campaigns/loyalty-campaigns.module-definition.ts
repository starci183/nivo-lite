import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyCampaignsOptions } from "./loyalty-campaigns.options"

/** The configurable-module base of the loyalty-campaigns capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyCampaignsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyCampaignsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyCampaignsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentBrandProposalsOptions } from "./content-brand-proposals.options"

/** Configurable registration of the content-brand-proposals capability. */
const definition = new ConfigurableModuleBuilder<ContentBrandProposalsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentBrandProposalsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentBrandProposalsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentBrandProposalsOptions } from "./content-brand-proposals.options"

/** Configurable registration of the content-brand-proposals capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentBrandProposalsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

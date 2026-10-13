import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentPillarsOptions } from "./content-pillars.options"

/** Configurable registration of the content-pillars capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentPillarsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentCadenceOptions } from "./content-cadence.options"

/** Configurable registration of the content-cadence capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentCadenceOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

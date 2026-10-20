import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoDelegationsOptions } from "./video-delegations.options"

/** The configurable-module base of the video delegations. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoDelegationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

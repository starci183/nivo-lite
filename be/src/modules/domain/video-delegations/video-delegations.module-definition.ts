import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoDelegationsOptions } from "./video-delegations.options"

/** The configurable-module base of the video delegations. */
const definition = new ConfigurableModuleBuilder<VideoDelegationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoDelegationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoDelegationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

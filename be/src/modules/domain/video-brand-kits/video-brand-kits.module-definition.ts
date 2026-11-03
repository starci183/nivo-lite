import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoBrandKitsOptions } from "./video-brand-kits.options"

/** The configurable-module base of workspace video kits. */
const definition = new ConfigurableModuleBuilder<VideoBrandKitsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoBrandKitsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoBrandKitsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

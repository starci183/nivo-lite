import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ThreadWorkOptions } from "./thread-work.options"

/** The configurable-module base of the thread-work capability. */
const definition = new ConfigurableModuleBuilder<ThreadWorkOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ThreadWorkOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ThreadWorkOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

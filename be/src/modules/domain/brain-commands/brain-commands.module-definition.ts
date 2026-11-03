import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainCommandsOptions } from "./brain-commands.options"

/** The configurable-module base of the brain-commands capability. */
const definition = new ConfigurableModuleBuilder<BrainCommandsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainCommandsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainCommandsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { IdsOptions } from "./ids.options"

/** The configurable-module base of the ids capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<IdsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    IdsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: IdsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

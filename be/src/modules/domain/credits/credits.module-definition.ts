import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { CreditsOptions } from "./credits.options"

/** The configurable-module base of the credits capability. */
const definition = new ConfigurableModuleBuilder<CreditsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    CreditsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: CreditsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

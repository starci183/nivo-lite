import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { IdentityOptions } from "./identity.options"

/** The configurable-module base of the identity capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<IdentityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    IdentityOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: IdentityOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

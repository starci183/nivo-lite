import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AuthorityActionsOptions } from "./authority-actions.options"

/** The configurable-module base of the authority actions capability. */
const definition = new ConfigurableModuleBuilder<AuthorityActionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AuthorityActionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AuthorityActionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

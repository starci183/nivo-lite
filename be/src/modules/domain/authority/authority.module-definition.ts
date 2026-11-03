import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AuthorityOptions } from "./authority.options"

/** The configurable-module base of the authority capability. */
const definition = new ConfigurableModuleBuilder<AuthorityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AuthorityOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AuthorityOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

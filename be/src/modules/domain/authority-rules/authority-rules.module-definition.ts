import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AuthorityRulesOptions } from "./authority-rules.options"

/** The configurable-module base of the authority-rules capability. */
const definition = new ConfigurableModuleBuilder<AuthorityRulesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AuthorityRulesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AuthorityRulesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MemberGrantsOptions } from "./member-grants.options"

/** The configurable-module base of the member-grants capability. */
const definition = new ConfigurableModuleBuilder<MemberGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MemberGrantsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MemberGrantsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

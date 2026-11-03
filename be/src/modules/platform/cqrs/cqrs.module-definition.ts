import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { CqrsOptions } from "./cqrs.options"

/** The configurable-module base of the cqrs capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<CqrsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    CqrsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: CqrsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

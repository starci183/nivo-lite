import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ClockOptions } from "./clock.options"

/** The configurable-module base of the clock capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ClockOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ClockOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ClockOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

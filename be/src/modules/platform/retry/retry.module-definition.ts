import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { RetryOptions } from "./retry.options"

/** The configurable-module base of the retry capability; the app root decides its global scope. */
const definition = new ConfigurableModuleBuilder<RetryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    RetryOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: RetryOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

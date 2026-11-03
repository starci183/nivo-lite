import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OpenclawOptions } from "./openclaw.options"

/** The configurable-module base of the OpenClaw integration. */
const definition = new ConfigurableModuleBuilder<OpenclawOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OpenclawOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OpenclawOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

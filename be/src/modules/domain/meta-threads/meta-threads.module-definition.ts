import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MetaThreadsOptions } from "./meta-threads.options"

/** Configurable-module base for the meta-threads capability. */
const definition = new ConfigurableModuleBuilder<MetaThreadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MetaThreadsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MetaThreadsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

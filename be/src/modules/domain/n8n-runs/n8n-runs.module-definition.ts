import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { N8nRunsOptions } from "./n8n-runs.options"

/** The configurable-module base of the n8n runs capability. */
const definition = new ConfigurableModuleBuilder<N8nRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    N8nRunsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: N8nRunsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

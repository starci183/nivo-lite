import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { N8nOptions } from "./n8n.options"

/** The configurable-module base of the n8n integration. */
const definition = new ConfigurableModuleBuilder<N8nOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    N8nOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: N8nOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

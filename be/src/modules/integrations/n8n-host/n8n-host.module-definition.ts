import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { N8nHostOptions } from "./n8n-host.options"

/** The configurable-module base of the n8n host integration. */
const definition = new ConfigurableModuleBuilder<N8nHostOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    N8nHostOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: N8nHostOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

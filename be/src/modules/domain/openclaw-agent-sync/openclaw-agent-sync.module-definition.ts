import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"

/** The configurable-module base of the openclaw-agent-sync capability. */
const definition = new ConfigurableModuleBuilder<OpenclawAgentSyncOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OpenclawAgentSyncOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OpenclawAgentSyncOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

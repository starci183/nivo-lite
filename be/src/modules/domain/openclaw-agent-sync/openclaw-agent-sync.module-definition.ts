import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"

/** The configurable-module base of the openclaw-agent-sync capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OpenclawAgentSyncOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

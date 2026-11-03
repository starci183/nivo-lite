import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentSyncOptions } from "./agent-sync.options"

/** The configurable-module base of the agent-sync module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentSyncOptions>()

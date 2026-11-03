import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentSyncMessageOptions } from "./agent-sync-message.options"

/** The configurable-module base of the agent-sync-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentSyncMessageOptions>()

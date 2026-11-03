import { defineConfigurableModule } from "@starci/nest-kit"
import type { SyncAgentsOptions } from "./sync-agents.options"

/** The configurable-module base of the sync-agents module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SyncAgentsOptions>()

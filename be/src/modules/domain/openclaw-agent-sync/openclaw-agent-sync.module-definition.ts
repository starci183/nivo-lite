import { defineCapabilityModule } from "@starci/nest-kit"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OpenclawAgentSyncOptions>()

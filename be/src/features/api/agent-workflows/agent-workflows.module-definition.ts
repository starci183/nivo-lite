import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentWorkflowsApiOptions } from "./agent-workflows.options"

/** The configurable-module base of the workflows module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentWorkflowsApiOptions>()

import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentDoorsApiOptions } from "./agent-doors.options"

/** The configurable-module base of the agent-doors module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentDoorsApiOptions>()

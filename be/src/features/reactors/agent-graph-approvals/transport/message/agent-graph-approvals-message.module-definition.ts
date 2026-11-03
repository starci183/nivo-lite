import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentGraphApprovalsMessageOptions } from "./agent-graph-approvals-message.options"

/** The configurable-module base of the agent graph approvals message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentGraphApprovalsMessageOptions>()

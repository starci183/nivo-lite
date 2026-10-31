import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentGraphApprovalsOptions } from "./agent-graph-approvals.options"

/** The configurable-module base of the agent graph approvals reactor. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentGraphApprovalsOptions>().setClassMethodName("register").build()

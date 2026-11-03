import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentGraphApprovalsOptions } from "./agent-graph-approvals.options"

type Host = ConfigurableModuleHost<AgentGraphApprovalsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentGraphApprovalsOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the agent graph approvals reactor. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent graph approvals reactor. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent graph approvals reactor. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

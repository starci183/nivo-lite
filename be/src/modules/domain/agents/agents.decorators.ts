import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentConnectionsDirectory, InstallationDirectory, KnowledgeLens, ModuleProfiles } from "./agents.port"
import type { AgentsOptions } from "./agents.options"

/** Token of the agents options, exported so a spec can provide it. */
export const AGENTS_OPTIONS: unique symbol = Symbol("domain.agents.options")

/** Token of the module installations port (modules lane). */
export const AGENTS_INSTALLATIONS: unique symbol = Symbol("domain.agents.installations")

/** Token of the business knowledge port (knowledge lane). */
export const AGENTS_KNOWLEDGE: unique symbol = Symbol("domain.agents.knowledge")

/** Token of the module definitions port (modules lane). */
export const AGENTS_MODULES: unique symbol = Symbol("domain.agents.modules")

/** Token of the agent connections port (agent-connections lane). */
export const AGENTS_CONNECTIONS: unique symbol = Symbol("domain.agents.connections")

/** Injects the agents options. Parameter type: AgentsOptions. */
export const InjectAgentsOptions = (): TypedParameterDecorator<AgentsOptions> => injector<AgentsOptions>(AGENTS_OPTIONS)

/** Injects the module installations port. Parameter type: InstallationDirectory. */
export const InjectInstallations = (): TypedParameterDecorator<InstallationDirectory> =>
    injector<InstallationDirectory>(AGENTS_INSTALLATIONS)

/** Injects the business knowledge port. Parameter type: KnowledgeLens. */
export const InjectKnowledge = (): TypedParameterDecorator<KnowledgeLens> => injector<KnowledgeLens>(AGENTS_KNOWLEDGE)

/** Injects the module definitions port. Parameter type: ModuleProfiles. */
export const InjectModuleProfiles = (): TypedParameterDecorator<ModuleProfiles> =>
    injector<ModuleProfiles>(AGENTS_MODULES)

/** Injects the agent connections port. Parameter type: AgentConnectionsDirectory. */
export const InjectAgentConnections = (): TypedParameterDecorator<AgentConnectionsDirectory> =>
    injector<AgentConnectionsDirectory>(AGENTS_CONNECTIONS)

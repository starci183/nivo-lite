import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentDirectory } from "./office-lines.port"

/** Token of the agent directory port; the app root binds it to the agents capability. */
export const AGENT_DIRECTORY: unique symbol = Symbol("domain.messages.agent-directory")

/** Injects the agent directory. Parameter type: AgentDirectory. */
export const InjectAgentDirectory = (): TypedParameterDecorator<AgentDirectory> =>
    injector<AgentDirectory>(AGENT_DIRECTORY)

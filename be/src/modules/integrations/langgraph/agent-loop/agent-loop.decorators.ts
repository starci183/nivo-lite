import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentLoops } from "./agent-loop.port"

/** Token of the agent loop. */
export const AGENT_LOOPS: unique symbol = Symbol("integrations.langgraph.agent-loops")

/** Injects the loop of a step's agent. Parameter type: AgentLoops. */
export const InjectAgentLoops = (): TypedParameterDecorator<AgentLoops> => injector<AgentLoops>(AGENT_LOOPS)

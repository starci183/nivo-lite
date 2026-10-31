import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentTurnsOptions } from "./agent-turns.options"
import type { AgentGraphBrief, AgentTurnRunner } from "./agent-turns.port"

/** Token of the agent-turns options, exported so a spec can provide it. */
export const AGENT_TURNS_OPTIONS: unique symbol = Symbol("domain.agent-turns.options")

/** Token of the turn runner port: the replaceable seam under the executor. */
export const AGENT_TURN_RUNNER: unique symbol = Symbol("domain.agent-turns.turn-runner")

/** Token of the action graph brief port: absent until the action graph binds one, and then a turn lists no intents. */
export const AGENT_GRAPH_BRIEF: unique symbol = Symbol("domain.agent-turns.graph-brief")

/** Injects the options of the agent turns. Parameter type: AgentTurnsOptions. */
export const InjectAgentTurnsOptions = (): TypedParameterDecorator<AgentTurnsOptions> =>
    injector<AgentTurnsOptions>(AGENT_TURNS_OPTIONS)

/** Injects the turn runner port. Parameter type: AgentTurnRunner. */
export const InjectAgentTurnRunner = (): TypedParameterDecorator<AgentTurnRunner> =>
    injector<AgentTurnRunner>(AGENT_TURN_RUNNER)

/** Injects the action graph brief port. Parameter type: AgentGraphBrief. */
export const InjectAgentGraphBrief = (): TypedParameterDecorator<AgentGraphBrief> =>
    injector<AgentGraphBrief>(AGENT_GRAPH_BRIEF)

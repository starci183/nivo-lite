import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentTurnsOptions } from "./agent-turns.options"
import type { AgentTurnRunner, IntentFiles } from "./agent-turns.port"

/** Token of the agent-turns options, exported so a spec can provide it. */
export const AGENT_TURNS_OPTIONS: unique symbol = Symbol("domain.agent-turns.options")

/** Token of the turn runner port: the replaceable seam under the executor. */
export const AGENT_TURN_RUNNER: unique symbol = Symbol("domain.agent-turns.turn-runner")

/** Injects the options of the agent turns. Parameter type: AgentTurnsOptions. */
export const InjectAgentTurnsOptions = (): TypedParameterDecorator<AgentTurnsOptions> =>
    injector<AgentTurnsOptions>(AGENT_TURNS_OPTIONS)

/** Injects the turn runner port. Parameter type: AgentTurnRunner. */
export const InjectAgentTurnRunner = (): TypedParameterDecorator<AgentTurnRunner> =>
    injector<AgentTurnRunner>(AGENT_TURN_RUNNER)

/** Token of the chat files port: absent until the chat files bind one, and then a turn carries no file. */
export const INTENT_FILES: unique symbol = Symbol("domain.agent-turns.intent-files")

/** Injects the chat files port. Parameter type: IntentFiles. */
export const InjectIntentFiles = (): TypedParameterDecorator<IntentFiles> => injector<IntentFiles>(INTENT_FILES)

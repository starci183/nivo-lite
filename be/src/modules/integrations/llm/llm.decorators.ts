import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LlmPool, LlmPort } from "./llm.port"

/** Token of the AI pool the model port calls through, exported so a spec can provide it. */
export const LLM_POOL: unique symbol = Symbol("integrations.llm.pool")

/** Token of the LlmPort. */
export const LLM: unique symbol = Symbol("integrations.llm")

/** Injects the AI pool. Parameter type: LlmPool. */
export const InjectLlmPool = (): TypedParameterDecorator<LlmPool> => injector<LlmPool>(LLM_POOL)

/** Injects the model port. Parameter type: LlmPort. */
export const InjectLlm = (): TypedParameterDecorator<LlmPort> => injector<LlmPort>(LLM)

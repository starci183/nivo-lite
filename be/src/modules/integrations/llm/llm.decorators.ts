import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LlmOptions } from "./llm.options"
import type { LlmPort } from "./llm.port"

/** Token of the options of the llm integration, exported so a spec can provide it. */
export const LLM_OPTIONS: unique symbol = Symbol("integrations.llm.options")

/** Token of the LlmPort. */
export const LLM: unique symbol = Symbol("integrations.llm")

/** Injects the options of the llm integration. Parameter type: LlmOptions. */
export const InjectLlmOptions = (): TypedParameterDecorator<LlmOptions> => injector<LlmOptions>(LLM_OPTIONS)

/** Injects the model port. Parameter type: LlmPort. */
export const InjectLlm = (): TypedParameterDecorator<LlmPort> => injector<LlmPort>(LLM)

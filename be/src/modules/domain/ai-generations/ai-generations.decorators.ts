import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AiGenerationsOptions } from "./ai-generations.options"
import type { GenerationCompletion, UsageGate } from "./ai-generations.port"

/** Token of the ai-generations options, exported so a spec can provide it. */
export const AI_GENERATIONS_OPTIONS: unique symbol = Symbol("domain.ai-generations.options")

/** Token of the plan allowance and usage meter port (billing lane). */
export const AI_GENERATIONS_USAGE: unique symbol = Symbol("domain.ai-generations.usage")

/** Token of the post-generation application completion port. */
export const AI_GENERATIONS_COMPLETION: unique symbol = Symbol("domain.ai-generations.completion")

/** Injects the application completion port. Parameter type: GenerationCompletion. */
export const InjectGenerationCompletion = (): TypedParameterDecorator<GenerationCompletion> =>
    injector<GenerationCompletion>(AI_GENERATIONS_COMPLETION)

/** Injects the ai-generations options. Parameter type: AiGenerationsOptions. */
export const InjectAiGenerationsOptions = (): TypedParameterDecorator<AiGenerationsOptions> =>
    injector<AiGenerationsOptions>(AI_GENERATIONS_OPTIONS)

/** Injects the usage port. Parameter type: UsageGate. */
export const InjectUsage = (): TypedParameterDecorator<UsageGate> => injector<UsageGate>(AI_GENERATIONS_USAGE)

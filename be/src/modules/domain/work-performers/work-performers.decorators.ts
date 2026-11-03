import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PromptWriter } from "./work-performers.port"

/** Token of the prompt writer port. */
export const PROMPT_WRITER: unique symbol = Symbol("domain.work-performers.prompt-writer")

/** Injects the prompt writer. Parameter type: PromptWriter. */
export const InjectPromptWriter = (): TypedParameterDecorator<PromptWriter> => injector<PromptWriter>(PROMPT_WRITER)

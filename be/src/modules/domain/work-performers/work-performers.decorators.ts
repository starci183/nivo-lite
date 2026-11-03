import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkPerformersOptions } from "./work-performers.options"
import type { PromptWriter } from "./work-performers.port"

/** Token of the prompt writer port. */
export const PROMPT_WRITER: unique symbol = Symbol("domain.work-performers.prompt-writer")

/** Injects the prompt writer. Parameter type: PromptWriter. */
export const InjectPromptWriter = (): TypedParameterDecorator<PromptWriter> => injector<PromptWriter>(PROMPT_WRITER)

/** Token of the options of the capability. */
export const WORK_PERFORMERS_OPTIONS: unique symbol = Symbol("domain.work-performers.options")

/** Injects the options of the capability. Parameter type: WorkPerformersOptions. */
export const InjectWorkPerformersOptions = (): TypedParameterDecorator<WorkPerformersOptions> =>
    injector<WorkPerformersOptions>(WORK_PERFORMERS_OPTIONS)

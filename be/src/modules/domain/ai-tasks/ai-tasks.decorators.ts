import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AiTasksService } from "./ai-tasks.service"
import type { AiTasksOptions } from "./ai-tasks.options"
import type { AiTaskMeter, AiTaskRecall, AiTaskTextGenerator } from "./ai-tasks.port"

/** Token of the prompt library's options, exported so a spec can provide it. */
export const AI_TASKS_OPTIONS: unique symbol = Symbol("domain.ai-tasks.options")

/** Token of the text generator port. */
export const AI_TASKS_TEXT_GENERATOR: unique symbol = Symbol("domain.ai-tasks.text-generator")

/** Token of the usage meter port. */
export const AI_TASKS_METER: unique symbol = Symbol("domain.ai-tasks.meter")

/** Token of the Second Brain recall port. */
export const AI_TASKS_RECALL: unique symbol = Symbol("domain.ai-tasks.recall")

/** Injects the options of the prompt library. Parameter type: AiTasksOptions. */
export const InjectAiTasksOptions = (): TypedParameterDecorator<AiTasksOptions> =>
    injector<AiTasksOptions>(AI_TASKS_OPTIONS)

/** Injects the text generator port. Parameter type: AiTaskTextGenerator. */
export const InjectAiTaskTextGenerator = (): TypedParameterDecorator<AiTaskTextGenerator> =>
    injector<AiTaskTextGenerator>(AI_TASKS_TEXT_GENERATOR)

/** Injects the usage meter port. Parameter type: AiTaskMeter. */
export const InjectAiTaskMeter = (): TypedParameterDecorator<AiTaskMeter> => injector<AiTaskMeter>(AI_TASKS_METER)

/** Injects the Second Brain recall port. Parameter type: AiTaskRecall. */
export const InjectAiTaskRecall = (): TypedParameterDecorator<AiTaskRecall> => injector<AiTaskRecall>(AI_TASKS_RECALL)

/** Token of the concrete prompt library, for callers outside the integration. */
export const AI_TASKS: unique symbol = Symbol("domain.ai-tasks.client")

/** Injects the prompt library through its integration-owned token. Parameter type: AiTasksService. */
export const InjectAiTasks = (): TypedParameterDecorator<AiTasksService> => injector<AiTasksService>(AI_TASKS)

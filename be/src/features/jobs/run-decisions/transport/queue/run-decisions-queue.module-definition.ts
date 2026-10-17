import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunDecisionsQueueOptions } from "./run-decisions-queue.options"

/** The configurable-module base of the run-decisions-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunDecisionsQueueOptions>().setClassMethodName("register").build()

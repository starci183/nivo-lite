import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunBrainCommandQueueOptions } from "./run-brain-command-queue.options"

/** The configurable-module base of the run-brain-command-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunBrainCommandQueueOptions>().setClassMethodName("register").build()

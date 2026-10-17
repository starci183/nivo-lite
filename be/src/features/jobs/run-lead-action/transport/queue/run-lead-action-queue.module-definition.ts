import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunLeadActionQueueOptions } from "./run-lead-action-queue.options"

/** The configurable-module base of the run-lead-action-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunLeadActionQueueOptions>().setClassMethodName("register").build()

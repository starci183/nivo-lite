import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunLeadGenQueueOptions } from "./run-lead-gen-queue.options"

/** The configurable-module base of the run-lead-gen-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunLeadGenQueueOptions>().setClassMethodName("register").build()

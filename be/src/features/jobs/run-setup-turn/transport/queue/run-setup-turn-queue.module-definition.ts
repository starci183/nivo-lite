import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunSetupTurnQueueOptions } from "./run-setup-turn-queue.options"

/** The configurable-module base of the run-setup-turn-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunSetupTurnQueueOptions>().setClassMethodName("register").build()

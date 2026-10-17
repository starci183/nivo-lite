import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunZaloWizardQueueOptions } from "./run-zalo-wizard-queue.options"

/** The configurable-module base of the run-zalo-wizard-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunZaloWizardQueueOptions>().setClassMethodName("register").build()

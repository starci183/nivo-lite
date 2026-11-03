import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAgentStepOptions } from "./run-agent-step.options"

/** The configurable-module base of the run-agent-step module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAgentStepOptions>()

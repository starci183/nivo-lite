import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentStepOptions } from "./agent-step.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentStepOptions>()

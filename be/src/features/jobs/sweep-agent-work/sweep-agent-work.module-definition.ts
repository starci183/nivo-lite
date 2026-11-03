import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepAgentWorkOptions } from "./sweep-agent-work.options"

/** The configurable-module base of the sweep-agent-work module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepAgentWorkOptions>()

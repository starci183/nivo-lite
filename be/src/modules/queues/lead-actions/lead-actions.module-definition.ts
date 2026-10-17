import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadActionsQueueOptions } from "./lead-actions.options"

/** The configurable-module base of the lead-actions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadActionsQueueOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadActionsQueueOptions } from "./lead-actions.options"

/** The configurable-module base of the lead-actions module. */
const definition = new ConfigurableModuleBuilder<LeadActionsQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<LeadActionsQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: LeadActionsQueueOptions = definition.OPTIONS_TYPE

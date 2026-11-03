import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LeadGenQueueOptions } from "./lead-gen.options"

/** The configurable-module base of the lead-gen module. */
const definition = new ConfigurableModuleBuilder<LeadGenQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<LeadGenQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: LeadGenQueueOptions = definition.OPTIONS_TYPE

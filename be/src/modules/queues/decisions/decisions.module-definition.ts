import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DecisionsQueueOptions } from "./decisions.options"

/** The configurable-module base of the decisions module. */
const definition = new ConfigurableModuleBuilder<DecisionsQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<DecisionsQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DecisionsQueueOptions = definition.OPTIONS_TYPE

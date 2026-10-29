import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationTriggersOptions } from "./automation-triggers.options"

/** The configurable-module base of the automation-triggers module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AutomationTriggersOptions>().setClassMethodName("register").build()

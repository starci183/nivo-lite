import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationTriggersMessageOptions } from "./automation-triggers-message.options"

/** The configurable-module base of the automation-triggers-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AutomationTriggersMessageOptions>().setClassMethodName("register").build()

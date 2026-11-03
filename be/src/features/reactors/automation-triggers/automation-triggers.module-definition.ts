import { defineConfigurableModule } from "@starci/nest-kit"
import type { AutomationTriggersOptions } from "./automation-triggers.options"

/** The configurable-module base of the automation-triggers module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AutomationTriggersOptions>()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationsApiOptions } from "./automations.options"

/** The configurable-module base of the automations module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AutomationsApiOptions>().setClassMethodName("register").build()

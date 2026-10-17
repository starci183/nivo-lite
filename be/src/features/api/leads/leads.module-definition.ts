import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadsApiOptions } from "./leads.options"

/** The configurable-module base of the leads module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadsApiOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesApiOptions } from "./sales.options"

/** The configurable-module base of the sales module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SalesApiOptions>().setClassMethodName("register").build()

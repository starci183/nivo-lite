import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CheckConnectionHealthOptions } from "./check-connection-health.options"

/** The configurable-module base of the check-connection-health module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CheckConnectionHealthOptions>().setClassMethodName("register").build()

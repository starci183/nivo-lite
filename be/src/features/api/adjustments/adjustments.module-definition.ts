import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AdjustmentsApiOptions } from "./adjustments.options"

/** The configurable-module base of the adjustments module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AdjustmentsApiOptions>().setClassMethodName("register").build()

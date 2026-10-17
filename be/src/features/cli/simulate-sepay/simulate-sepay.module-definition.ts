import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SimulateSepayOptions } from "./simulate-sepay.options"

/** The configurable-module base of the simulate-sepay module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SimulateSepayOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadGenApiOptions } from "./leadgen.options"

/** The configurable-module base of the leadgen module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadGenApiOptions>().setClassMethodName("register").build()

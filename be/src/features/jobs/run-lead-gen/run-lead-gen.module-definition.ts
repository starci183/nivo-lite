import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunLeadGenOptions } from "./run-lead-gen.options"

/** The configurable-module base of the run-lead-gen module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunLeadGenOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadGenQueueOptions } from "./lead-gen.options"

/** The configurable-module base of the lead-gen module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadGenQueueOptions>().setClassMethodName("register").build()

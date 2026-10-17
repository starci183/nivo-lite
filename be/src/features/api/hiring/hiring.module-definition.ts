import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HiringApiOptions } from "./hiring.options"

/** The configurable-module base of the hiring module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HiringApiOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HiringTickOptions } from "./hiring-tick.options"

/** The configurable-module base of the hiring-tick module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HiringTickOptions>().setClassMethodName("register").build()

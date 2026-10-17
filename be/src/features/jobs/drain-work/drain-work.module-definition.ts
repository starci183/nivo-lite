import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DrainWorkOptions } from "./drain-work.options"

/** The configurable-module base of the drain-work module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DrainWorkOptions>().setClassMethodName("register").build()

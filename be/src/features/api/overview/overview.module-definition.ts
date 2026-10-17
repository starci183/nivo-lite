import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OverviewApiOptions } from "./overview.options"

/** The configurable-module base of the overview module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OverviewApiOptions>().setClassMethodName("register").build()

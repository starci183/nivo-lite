import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SweepSystemHistoryOptions } from "./sweep-system-history.options"

/** The configurable-module base of the sweep-system-history module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SweepSystemHistoryOptions>().setClassMethodName("register").build()

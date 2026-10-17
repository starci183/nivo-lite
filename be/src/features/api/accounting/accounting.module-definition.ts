import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountingApiOptions } from "./accounting.options"

/** The configurable-module base of the accounting module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AccountingApiOptions>().setClassMethodName("register").build()

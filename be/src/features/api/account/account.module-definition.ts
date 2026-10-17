import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountApiOptions } from "./account.options"

/** The configurable-module base of the account module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AccountApiOptions>().setClassMethodName("register").build()

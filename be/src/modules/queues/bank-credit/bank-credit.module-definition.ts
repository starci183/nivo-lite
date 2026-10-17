import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankCreditOptions } from "./bank-credit.options"

/** The configurable-module base of the bank-credit module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankCreditOptions>().setClassMethodName("register").build()

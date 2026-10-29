import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankCreditSettlementMessageOptions } from "./bank-credit-settlement-message.options"

/** The configurable-module base of the bank-credit-settlement-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankCreditSettlementMessageOptions>().setClassMethodName("register").build()

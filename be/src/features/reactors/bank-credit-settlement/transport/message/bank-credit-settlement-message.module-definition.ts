import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { BankCreditSettlementMessageOptions } from "./bank-credit-settlement-message.options"

type Host = ConfigurableModuleHost<BankCreditSettlementMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<BankCreditSettlementMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the bank-credit-settlement-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the bank-credit-settlement-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the bank-credit-settlement-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

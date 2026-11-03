import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { BankCreditSettlementOptions } from "./bank-credit-settlement.options"

type Host = ConfigurableModuleHost<BankCreditSettlementOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<BankCreditSettlementOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the bank-credit-settlement module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the bank-credit-settlement module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the bank-credit-settlement module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

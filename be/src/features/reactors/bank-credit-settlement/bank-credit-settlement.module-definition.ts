import { defineConfigurableModule } from "@starci/nest-kit"
import type { BankCreditSettlementOptions } from "./bank-credit-settlement.options"

/** The configurable-module base of the bank-credit-settlement module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BankCreditSettlementOptions>()

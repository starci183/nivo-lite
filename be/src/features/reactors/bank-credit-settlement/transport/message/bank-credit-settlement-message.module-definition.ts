import { defineConfigurableModule } from "@starci/nest-kit"
import type { BankCreditSettlementMessageOptions } from "./bank-credit-settlement-message.options"

/** The configurable-module base of the bank-credit-settlement-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BankCreditSettlementMessageOptions>()

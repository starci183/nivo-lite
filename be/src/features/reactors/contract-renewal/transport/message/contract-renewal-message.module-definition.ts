import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContractRenewalMessageOptions } from "./contract-renewal-message.options"

/** The configurable-module base of the contract-renewal-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContractRenewalMessageOptions>()

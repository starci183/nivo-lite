import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContractRenewalOptions } from "./contract-renewal.options"

/** The configurable-module base of the contract-renewal module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContractRenewalOptions>()

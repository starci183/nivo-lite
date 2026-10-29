import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContractRenewalMessageOptions } from "./contract-renewal-message.options"

/** The configurable-module base of the contract-renewal-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContractRenewalMessageOptions>().setClassMethodName("register").build()

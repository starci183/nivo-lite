import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContractRenewalMessageOptions } from "./contract-renewal-message.options"

type Host = ConfigurableModuleHost<ContractRenewalMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContractRenewalMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the contract-renewal-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the contract-renewal-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the contract-renewal-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

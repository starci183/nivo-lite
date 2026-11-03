import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContractRenewalOptions } from "./contract-renewal.options"

type Host = ConfigurableModuleHost<ContractRenewalOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContractRenewalOptions>().setClassMethodName("register").build()

/** The configurable-module base of the contract-renewal module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the contract-renewal module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the contract-renewal module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

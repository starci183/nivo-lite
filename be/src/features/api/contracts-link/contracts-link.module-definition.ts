import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContractsLinkApiOptions } from "./contracts-link.options"

/** The configurable-module base of the contracts-link module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContractsLinkApiOptions>().setClassMethodName("register").build()

import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContractsLinkApiOptions } from "./contracts-link.options"

/** The configurable-module base of the contracts-link module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContractsLinkApiOptions>()

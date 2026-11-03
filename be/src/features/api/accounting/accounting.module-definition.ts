import { defineConfigurableModule } from "@starci/nest-kit"
import type { AccountingApiOptions } from "./accounting.options"

/** The configurable-module base of the accounting module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AccountingApiOptions>()

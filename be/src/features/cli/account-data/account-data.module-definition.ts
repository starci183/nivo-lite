import { defineConfigurableModule } from "@starci/nest-kit"
import type { AccountDataCliOptions } from "./account-data.options"

/** The configurable-module base of the account-data cli module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AccountDataCliOptions>()

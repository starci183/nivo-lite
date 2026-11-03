import { defineConfigurableModule } from "@starci/nest-kit"
import type { AccountApiOptions } from "./account.options"

/** The configurable-module base of the account module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AccountApiOptions>()

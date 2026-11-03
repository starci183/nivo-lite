import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedTestAccountsOptions } from "./seed-test-accounts.options"

/** The configurable-module base of the seed-test-accounts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedTestAccountsOptions>()

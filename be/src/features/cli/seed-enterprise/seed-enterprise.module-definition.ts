import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedEnterpriseOptions } from "./seed-enterprise.options"

/** The configurable-module base of the seed-enterprise module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedEnterpriseOptions>()

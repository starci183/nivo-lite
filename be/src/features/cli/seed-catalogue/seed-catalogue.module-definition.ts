import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedCatalogueOptions } from "./seed-catalogue.options"

/** The configurable-module base of the seed-catalogue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedCatalogueOptions>()

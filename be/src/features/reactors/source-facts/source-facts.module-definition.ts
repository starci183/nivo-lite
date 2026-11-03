import { defineConfigurableModule } from "@starci/nest-kit"
import type { SourceFactsOptions } from "./source-facts.options"

/** The configurable-module base of the source-facts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SourceFactsOptions>()

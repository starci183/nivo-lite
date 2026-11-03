import { defineConfigurableModule } from "@starci/nest-kit"
import type { SourceFactsMessageOptions } from "./source-facts-message.options"

/** The configurable-module base of the source-facts-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SourceFactsMessageOptions>()

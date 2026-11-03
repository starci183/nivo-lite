import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentApiOptions } from "./content.options"

/** The configurable-module base of the content module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentApiOptions>()

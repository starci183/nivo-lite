import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentMediaApiOptions } from "./content-media.options"

/** The configurable-module base of the content-media module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentMediaApiOptions>()

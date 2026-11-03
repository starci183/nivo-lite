import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentPublishingApiOptions } from "./content-publishing.options"

/** The configurable-module base of the content-publishing module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentPublishingApiOptions>()

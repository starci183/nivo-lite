import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicDocumentsApiOptions } from "./public-documents.options"

/** The configurable-module base of the public-documents feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicDocumentsApiOptions>()

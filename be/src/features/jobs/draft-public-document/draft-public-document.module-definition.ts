import { defineConfigurableModule } from "@starci/nest-kit"
import type { DraftPublicDocumentOptions } from "./draft-public-document.options"

/** The configurable-module base of the draft-public-document module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DraftPublicDocumentOptions>()

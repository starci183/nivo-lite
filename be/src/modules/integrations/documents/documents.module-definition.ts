import { defineCapabilityModule } from "@starci/nest-kit"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DocumentsOptions>({
    optionsInjectionToken: DOCUMENTS_OPTIONS,
})

import { ConfigurableModuleBuilder } from "@nestjs/common"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"

/** The configurable-module base of the documents integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DocumentsOptions>({
    optionsInjectionToken: DOCUMENTS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"

/** The configurable-module base of the documents integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<DocumentsOptions>({
    optionsInjectionToken: DOCUMENTS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DocumentsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: DocumentsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

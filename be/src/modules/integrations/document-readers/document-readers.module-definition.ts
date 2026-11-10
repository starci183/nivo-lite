import { defineCapabilityModule } from "@starci/nest-kit"
import type { DocumentReadersOptions } from "./document-readers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DocumentReadersOptions>({
    optionsInjectionToken: Symbol("integrations.document-readers.options"),
})

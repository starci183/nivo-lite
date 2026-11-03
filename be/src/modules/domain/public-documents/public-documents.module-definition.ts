import { defineCapabilityModule } from "@starci/nest-kit"
import type { PublicDocumentsOptions } from "./public-documents.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PublicDocumentsOptions>()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicDocumentsOptions } from "./public-documents.options"

/** The configurable module base of the public-documents capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PublicDocumentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

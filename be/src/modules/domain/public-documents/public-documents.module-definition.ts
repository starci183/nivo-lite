import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PublicDocumentsOptions } from "./public-documents.options"

/** The configurable module base of the public-documents capability. */
const definition = new ConfigurableModuleBuilder<PublicDocumentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PublicDocumentsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PublicDocumentsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

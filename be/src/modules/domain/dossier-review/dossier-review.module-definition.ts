import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DossierReviewOptions } from "./dossier-review.options"

/** The configurable-module base of the dossier-review capability. */
const definition = new ConfigurableModuleBuilder<DossierReviewOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DossierReviewOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: DossierReviewOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

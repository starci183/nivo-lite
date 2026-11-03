import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DossierReviewAiOptions } from "./dossier-review-ai.options"

/** The configurable-module base of the dossier-review-ai capability. */
const definition = new ConfigurableModuleBuilder<DossierReviewAiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DossierReviewAiOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: DossierReviewAiOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

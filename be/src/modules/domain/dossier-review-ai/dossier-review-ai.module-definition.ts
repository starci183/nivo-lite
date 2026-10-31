import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DossierReviewAiOptions } from "./dossier-review-ai.options"

/** The configurable-module base of the dossier-review-ai capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DossierReviewAiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DossierReviewOptions } from "./dossier-review.options"

/** The configurable-module base of the dossier-review capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DossierReviewOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

import { defineCapabilityModule } from "@starci/nest-kit"
import type { DossierReviewOptions } from "./dossier-review.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DossierReviewOptions>()

import { defineCapabilityModule } from "@starci/nest-kit"
import type { DossierReviewAiOptions } from "./dossier-review-ai.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DossierReviewAiOptions>()

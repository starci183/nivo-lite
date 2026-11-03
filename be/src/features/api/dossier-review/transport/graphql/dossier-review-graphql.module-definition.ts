import { defineConfigurableModule } from "@starci/nest-kit"
import type { DossierReviewGraphqlOptions } from "./dossier-review-graphql.options"

/** The configurable-module base of the dossier-review-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DossierReviewGraphqlOptions>()

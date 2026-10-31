import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DossierReviewGraphqlOptions } from "./dossier-review-graphql.options"

/** The configurable-module base of the dossier-review-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DossierReviewGraphqlOptions>().setClassMethodName("register").build()

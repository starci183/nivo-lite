import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DossierReviewApiOptions } from "./dossier-review.options"

/** The configurable-module base of the dossier-review module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DossierReviewApiOptions>().setClassMethodName("register").build()

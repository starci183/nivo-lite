import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReviewDossiersOptions } from "./review-dossiers.options"

/** The configurable-module base of the review-dossiers module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReviewDossiersOptions>().setClassMethodName("register").build()

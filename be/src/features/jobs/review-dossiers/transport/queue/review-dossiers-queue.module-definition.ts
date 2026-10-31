import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReviewDossiersQueueOptions } from "./review-dossiers-queue.options"

/** The configurable-module base of the review-dossiers-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReviewDossiersQueueOptions>().setClassMethodName("register").build()

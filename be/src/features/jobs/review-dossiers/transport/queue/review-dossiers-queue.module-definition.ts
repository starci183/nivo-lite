import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReviewDossiersQueueOptions } from "./review-dossiers-queue.options"

/** The configurable-module base of the review-dossiers-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReviewDossiersQueueOptions>()

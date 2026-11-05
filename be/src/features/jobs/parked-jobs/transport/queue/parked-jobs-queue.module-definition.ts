import { defineConfigurableModule } from "@starci/nest-kit"
import type { ParkedJobsQueueOptions } from "./parked-jobs-queue.options"

/** The configurable-module base of the parked-jobs-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ParkedJobsQueueOptions>()

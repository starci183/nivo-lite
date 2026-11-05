import { defineConfigurableModule } from "@starci/nest-kit"
import type { ModuleJobsQueueOptions } from "./module-jobs-queue.options"

/** The configurable-module base of the module-jobs-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ModuleJobsQueueOptions>()

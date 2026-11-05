import { defineConfigurableModule } from "@starci/nest-kit"
import type { ModuleJobsQueueOptions } from "./module-jobs.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ModuleJobsQueueOptions>()

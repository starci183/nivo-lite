import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProcessPublicApiQueueOptions } from "./process-public-api-queue.options"

/** The configurable-module base of the public API processing queue. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProcessPublicApiQueueOptions>()

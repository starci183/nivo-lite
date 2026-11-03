import { defineConfigurableModule } from "@starci/nest-kit"
import type { CheckConnectionHealthQueueOptions } from "./check-connection-health-queue.options"

/** The configurable-module base of the check-connection-health-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CheckConnectionHealthQueueOptions>()

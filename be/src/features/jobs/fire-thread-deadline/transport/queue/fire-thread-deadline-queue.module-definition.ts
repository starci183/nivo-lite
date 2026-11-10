import { defineConfigurableModule } from "@starci/nest-kit"
import type { FireThreadDeadlineQueueOptions } from "./fire-thread-deadline-queue.options"

/** The configurable-module base of the fire-thread-deadline-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<FireThreadDeadlineQueueOptions>()

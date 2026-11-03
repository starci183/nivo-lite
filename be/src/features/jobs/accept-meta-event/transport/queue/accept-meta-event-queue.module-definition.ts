import { defineConfigurableModule } from "@starci/nest-kit"
import type { AcceptMetaEventQueueOptions } from "./accept-meta-event-queue.options"

/** The configurable-module base of the accept-meta-event-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AcceptMetaEventQueueOptions>()

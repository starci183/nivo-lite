import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverGenericWebhookQueueOptions } from "./deliver-generic-webhook-queue.options"

/** The configurable-module base of the generic-webhook-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverGenericWebhookQueueOptions>()

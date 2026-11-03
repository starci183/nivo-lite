import { defineConfigurableModule } from "@starci/nest-kit"
import type { EmitWebhookEventQueueOptions } from "./emit-webhook-event-queue.options"

/** The configurable-module base of the emit-webhook-event-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<EmitWebhookEventQueueOptions>()

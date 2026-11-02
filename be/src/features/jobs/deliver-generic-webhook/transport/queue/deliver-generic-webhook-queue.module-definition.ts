import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeliverGenericWebhookQueueOptions } from "./deliver-generic-webhook-queue.options"

/** The configurable-module base of the generic-webhook-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DeliverGenericWebhookQueueOptions>().setClassMethodName("register").build()

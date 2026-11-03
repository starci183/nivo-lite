import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { EmitWebhookEventQueueOptions } from "./emit-webhook-event-queue.options"

type Host = ConfigurableModuleHost<EmitWebhookEventQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<EmitWebhookEventQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the emit-webhook-event-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the emit-webhook-event-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the emit-webhook-event-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

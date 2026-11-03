import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DeliverGenericWebhookQueueOptions } from "./deliver-generic-webhook-queue.options"

type Host = ConfigurableModuleHost<DeliverGenericWebhookQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DeliverGenericWebhookQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the generic-webhook-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the generic-webhook-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the generic-webhook-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

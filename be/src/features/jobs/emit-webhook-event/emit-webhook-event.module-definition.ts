import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { EmitWebhookEventOptions } from "./emit-webhook-event.options"

type Host = ConfigurableModuleHost<EmitWebhookEventOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<EmitWebhookEventOptions>().setClassMethodName("register").build()

/** The configurable-module base of the emit-webhook-event module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the emit-webhook-event module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the emit-webhook-event module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

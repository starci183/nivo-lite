import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EmitWebhookEventOptions } from "./emit-webhook-event.options"

/** The configurable-module base of the emit-webhook-event module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<EmitWebhookEventOptions>().setClassMethodName("register").build()

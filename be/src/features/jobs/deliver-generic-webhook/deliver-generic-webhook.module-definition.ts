import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeliverGenericWebhookOptions } from "./deliver-generic-webhook.options"

/** The configurable-module base of the generic-webhook job module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DeliverGenericWebhookOptions>().setClassMethodName("register").build()

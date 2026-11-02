import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GenericWebhookOptions } from "./generic-webhook.options"

/** The configurable-module base of the generic webhook producer. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GenericWebhookOptions>().setClassMethodName("register").build()

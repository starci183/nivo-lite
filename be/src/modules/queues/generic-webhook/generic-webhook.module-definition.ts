import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { GenericWebhookOptions } from "./generic-webhook.options"

/** The configurable-module base of the generic webhook producer. */
const definition = new ConfigurableModuleBuilder<GenericWebhookOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<GenericWebhookOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: GenericWebhookOptions = definition.OPTIONS_TYPE

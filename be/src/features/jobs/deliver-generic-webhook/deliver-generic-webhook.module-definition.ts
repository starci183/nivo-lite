import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverGenericWebhookOptions } from "./deliver-generic-webhook.options"

/** The configurable-module base of the generic-webhook job module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverGenericWebhookOptions>()

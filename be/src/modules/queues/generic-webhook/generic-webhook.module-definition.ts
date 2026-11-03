import { defineConfigurableModule } from "@starci/nest-kit"
import type { GenericWebhookOptions } from "./generic-webhook.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<GenericWebhookOptions>()

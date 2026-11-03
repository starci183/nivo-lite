import { defineConfigurableModule } from "@starci/nest-kit"
import type { EmitN8nEventOptions } from "./emit-n8n-event.options"

/** The configurable-module base of the emit-n8n-event module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<EmitN8nEventOptions>()

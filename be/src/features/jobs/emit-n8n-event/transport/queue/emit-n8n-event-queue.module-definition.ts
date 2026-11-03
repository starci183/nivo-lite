import { defineConfigurableModule } from "@starci/nest-kit"
import type { EmitN8nEventQueueOptions } from "./emit-n8n-event-queue.options"

/** The configurable-module base of the emit-n8n-event-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<EmitN8nEventQueueOptions>()

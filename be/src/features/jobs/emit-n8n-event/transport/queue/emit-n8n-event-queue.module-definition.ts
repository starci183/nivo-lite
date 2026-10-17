import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EmitN8nEventQueueOptions } from "./emit-n8n-event-queue.options"

/** The configurable-module base of the emit-n8n-event-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<EmitN8nEventQueueOptions>().setClassMethodName("register").build()

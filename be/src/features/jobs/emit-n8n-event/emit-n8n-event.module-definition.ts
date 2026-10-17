import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EmitN8nEventOptions } from "./emit-n8n-event.options"

/** The configurable-module base of the emit-n8n-event module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<EmitN8nEventOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nQueueOptions } from "./n8n.options"

/** The configurable-module base of the n8n module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<N8nQueueOptions>().setClassMethodName("register").build()

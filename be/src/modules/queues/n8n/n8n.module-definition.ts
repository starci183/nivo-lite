import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { N8nQueueOptions } from "./n8n.options"

/** The configurable-module base of the n8n module. */
const definition = new ConfigurableModuleBuilder<N8nQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<N8nQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: N8nQueueOptions = definition.OPTIONS_TYPE

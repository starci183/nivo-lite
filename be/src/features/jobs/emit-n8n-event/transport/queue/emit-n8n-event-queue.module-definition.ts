import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { EmitN8nEventQueueOptions } from "./emit-n8n-event-queue.options"

type Host = ConfigurableModuleHost<EmitN8nEventQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<EmitN8nEventQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the emit-n8n-event-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the emit-n8n-event-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the emit-n8n-event-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

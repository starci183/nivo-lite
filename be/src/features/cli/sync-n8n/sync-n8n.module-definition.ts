import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SyncN8nOptions } from "./sync-n8n.options"

/** The configurable-module base of the sync-n8n module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SyncN8nOptions>().setClassMethodName("register").build()

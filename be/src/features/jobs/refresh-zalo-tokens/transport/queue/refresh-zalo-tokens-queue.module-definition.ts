import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RefreshZaloTokensQueueOptions } from "./refresh-zalo-tokens-queue.options"

type Host = ConfigurableModuleHost<RefreshZaloTokensQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RefreshZaloTokensQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the refresh-zalo-tokens-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the refresh-zalo-tokens-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the refresh-zalo-tokens-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE

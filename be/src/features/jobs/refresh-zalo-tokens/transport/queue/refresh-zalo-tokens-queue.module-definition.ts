import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RefreshZaloTokensQueueOptions } from "./refresh-zalo-tokens-queue.options"

/** The configurable-module base of the refresh-zalo-tokens-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RefreshZaloTokensQueueOptions>().setClassMethodName("register").build()

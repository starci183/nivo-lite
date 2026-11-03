import { defineConfigurableModule } from "@starci/nest-kit"
import type { RefreshZaloTokensQueueOptions } from "./refresh-zalo-tokens-queue.options"

/** The configurable-module base of the refresh-zalo-tokens-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RefreshZaloTokensQueueOptions>()

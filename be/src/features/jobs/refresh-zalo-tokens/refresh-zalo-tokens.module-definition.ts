import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RefreshZaloTokensOptions } from "./refresh-zalo-tokens.options"

/** The configurable-module base of the refresh-zalo-tokens module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RefreshZaloTokensOptions>().setClassMethodName("register").build()

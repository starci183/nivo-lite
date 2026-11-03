import { defineConfigurableModule } from "@starci/nest-kit"
import type { RefreshZaloTokensOptions } from "./refresh-zalo-tokens.options"

/** The configurable-module base of the refresh-zalo-tokens module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RefreshZaloTokensOptions>()

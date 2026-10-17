import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayFeedHttpOptions } from "./sepay-feed-http.options"

/** The configurable-module base of the sepay-feed-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SepayFeedHttpOptions>().setClassMethodName("register").build()

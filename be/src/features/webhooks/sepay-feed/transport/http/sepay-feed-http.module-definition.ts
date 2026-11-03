import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayFeedHttpOptions } from "./sepay-feed-http.options"

/** The configurable-module base of the sepay-feed-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayFeedHttpOptions>()

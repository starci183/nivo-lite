import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloConnectionPageApiOptions } from "./zalo-connection-page.options"

/** The configurable-module base of the zalo-connection-page module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloConnectionPageApiOptions>().setClassMethodName("register").build()

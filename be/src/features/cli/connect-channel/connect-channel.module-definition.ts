import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectChannelOptions } from "./connect-channel.options"

/** The configurable-module base of the connect-channel module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectChannelOptions>().setClassMethodName("register").build()

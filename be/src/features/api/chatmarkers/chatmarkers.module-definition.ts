import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatMarkersApiOptions } from "./chatmarkers.options"

/** The configurable base of the chat markers feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatMarkersApiOptions>().setClassMethodName("register").build()

import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoGraphqlOptions } from "./video-graphql.options"

/** The configurable-module base of the video-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VideoGraphqlOptions>().setClassMethodName("register").build()

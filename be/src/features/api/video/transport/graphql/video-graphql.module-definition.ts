import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoGraphqlOptions } from "./video-graphql.options"

/** The configurable-module base of the video-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoGraphqlOptions>()

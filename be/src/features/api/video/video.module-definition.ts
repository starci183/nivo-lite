import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoApiOptions } from "./video.options"

/** The configurable-module base of the video module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoApiOptions>()

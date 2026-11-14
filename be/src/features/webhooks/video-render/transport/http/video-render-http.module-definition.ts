import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoRenderHttpOptions } from "./video-render-http.options"

/** The configurable-module base of the video-render-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoRenderHttpOptions>()

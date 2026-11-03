import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoRenderOptions } from "./video-render.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoRenderOptions>()

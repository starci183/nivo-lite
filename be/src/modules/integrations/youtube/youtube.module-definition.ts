import { defineCapabilityModule } from "@starci/nest-kit"
import { YOUTUBE_OPTIONS } from "./youtube.decorators"
import type { YoutubeOptions } from "./youtube.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<YoutubeOptions>({
    optionsInjectionToken: YOUTUBE_OPTIONS,
})

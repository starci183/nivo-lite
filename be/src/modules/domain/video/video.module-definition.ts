import { defineCapabilityModule } from "@starci/nest-kit"
import { VIDEO_OPTIONS } from "./video.decorators"
import type { VideoRegistration } from "./video.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoRegistration>({
    optionsInjectionToken: VIDEO_OPTIONS,
})

import { defineCapabilityModule } from "@starci/nest-kit"
import { JSON2VIDEO_OPTIONS } from "./json2video.decorators"
import type { Json2VideoOptions } from "./json2video.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<Json2VideoOptions>({
    optionsInjectionToken: JSON2VIDEO_OPTIONS,
})

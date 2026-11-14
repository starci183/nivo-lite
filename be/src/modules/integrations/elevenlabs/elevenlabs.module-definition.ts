import { defineCapabilityModule } from "@starci/nest-kit"
import { ELEVENLABS_OPTIONS } from "./elevenlabs.decorators"
import type { ElevenLabsOptions } from "./elevenlabs.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<ElevenLabsOptions>({
    optionsInjectionToken: ELEVENLABS_OPTIONS,
})

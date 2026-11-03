import { defineCapabilityModule } from "@starci/nest-kit"
import { TTS_OPTIONS } from "./tts.decorators"
import type { TtsOptions } from "./tts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TtsOptions>({
    optionsInjectionToken: TTS_OPTIONS,
})

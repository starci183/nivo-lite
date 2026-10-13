import { ConfigurableModuleBuilder } from "@nestjs/common"
import { TTS_OPTIONS } from "./tts.decorators"
import type { TtsOptions } from "./tts.options"

/** The configurable-module base of the text-to-speech integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TtsOptions>({
    optionsInjectionToken: TTS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

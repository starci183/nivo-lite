import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { TTS_OPTIONS } from "./tts.decorators"
import type { TtsOptions } from "./tts.options"

/** The configurable-module base of the text-to-speech integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<TtsOptions>({
    optionsInjectionToken: TTS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TtsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: TtsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { FFMPEG_OPTIONS } from "./ffmpeg.decorators"
import type { FfmpegOptions } from "./ffmpeg.options"

/** The configurable-module base of the ffmpeg integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<FfmpegOptions>({
    optionsInjectionToken: FFMPEG_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    FfmpegOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: FfmpegOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE

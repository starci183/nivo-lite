import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { FFMPEG } from "./ffmpeg.decorators"
import { FfmpegClient } from "./ffmpeg.client"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ffmpeg.module-definition"

@Module({})
/** The ffmpeg integration: the one caller of the ffmpeg and ffprobe binaries, behind the `Ffmpeg` port. */
export class FfmpegModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that renders videos. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), FfmpegClient, { provide: FFMPEG, useExisting: FfmpegClient }],
            exports: [FFMPEG],
        }
    }
}

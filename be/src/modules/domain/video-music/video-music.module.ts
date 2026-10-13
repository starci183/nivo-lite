import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MUSIC_STORE } from "./video-music.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-music.module-definition"
import { VideoMusicService } from "./video-music.service"

@Module({})
/** The music beds of the video render: the seed that writes them into the media bucket, where the renderer reads them. */
export class VideoMusicModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that seeds the beds. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: MUSIC_STORE, useExisting: options.store },
                VideoMusicService,
            ],
            exports: [VideoMusicService],
        }
    }
}

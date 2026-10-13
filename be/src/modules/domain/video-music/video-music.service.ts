import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { MEDIA_BUCKET, MUSIC_TRACKS, musicObjectPath } from "@modules/domain/video"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { VideoMusicError, VideoMusicErrorCode } from "./errors/video-music.error"
import type { MusicStore } from "./video-music.contracts"
import { InjectMusicStore } from "./video-music.decorators"
import { VideoMusicLogEvent } from "./video-music.log-events"

const MP3 = "audio/mpeg"

@Injectable()
/** The music beds of the video render: written once from the repo seed folder into the media bucket, where the renderer reads them. */
export class VideoMusicService {
    constructor(
        @InjectMusicStore() private readonly store: MusicStore,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Uploads `music/<track>.mp3` of the seed folder for every track, replacing earlier files; answers the object paths written. */
    async upload(seedDir: string): Promise<ReadonlyArray<string>> {
        const written: Array<string> = []
        await eachInOrder(MUSIC_TRACKS, async (track) => {
            const path = musicObjectPath(track.id)
            const { error } = await this.store.upload(MEDIA_BUCKET, path, await readFile(join(seedDir, path)), MP3)
            if (error !== null)
                throw new VideoMusicError({ code: VideoMusicErrorCode.StorageFailed, params: { path }, cause: error })
            written.push(path)
        })
        this.logger.info(VideoMusicLogEvent.Uploaded, { bucket: MEDIA_BUCKET, paths: written })
        return written
    }
}

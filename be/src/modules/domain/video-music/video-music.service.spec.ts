import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { VideoMusicError, VideoMusicErrorCode } from "./errors/video-music.error"
import type { MusicStore } from "./video-music.contracts"
import { MUSIC_STORE } from "./video-music.decorators"
import { VideoMusicLogEvent } from "./video-music.log-events"
import { VideoMusicService } from "./video-music.service"

const build = async () => {
    const store = mock<MusicStore>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoMusicService,
            { provide: MUSIC_STORE, useValue: store },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(VideoMusicService), store, logger }
}

describe("VideoMusicService", () => {
    let dir: string

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "video-music-"))
        await mkdir(join(dir, "music"))
        for (const id of ["sunny-pop", "calm-glow", "bold-beat"]) await writeFile(join(dir, "music", `${id}.mp3`), id)
    })

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    it("uploads every bed to the music folder of the media bucket and logs the paths", async () => {
        const { service, store, logger } = await build()
        store.upload.mockResolvedValue({ error: null })

        const written = await service.upload(dir)

        expect(written).toEqual(["music/sunny-pop.mp3", "music/calm-glow.mp3", "music/bold-beat.mp3"])
        expect(store.upload).toHaveBeenCalledWith(
            "media",
            "music/calm-glow.mp3",
            Buffer.from("calm-glow"),
            "audio/mpeg",
        )
        expect(logger.info).toHaveBeenCalledWith(VideoMusicLogEvent.Uploaded, { bucket: "media", paths: written })
    })

    it("fails with the storage error of the bed the store refused", async () => {
        const { service, store, logger } = await build()
        store.upload.mockResolvedValue({ error: new VideoMusicError({ code: VideoMusicErrorCode.StorageFailed }) })

        await expect(service.upload(dir)).rejects.toMatchObject({
            code: VideoMusicErrorCode.StorageFailed,
            params: { path: "music/sunny-pop.mp3" },
        })
        expect(store.upload).toHaveBeenCalledTimes(1)
        expect(logger.info).not.toHaveBeenCalled()
    })
})

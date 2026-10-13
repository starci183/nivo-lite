import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { VideoMusicErrorCode } from "./errors/video-music.error"
import type { MusicStore } from "./video-music.contracts"
import { VideoMusicLogEvent } from "./video-music.log-events"
import { VideoMusicService } from "./video-music.service"

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
        const store = mock<MusicStore>()
        store.upload.mockResolvedValue({ error: null })
        const logger = mock<Logger>()

        const written = await new VideoMusicService(store, logger).upload(dir)

        expect(written).toEqual(["music/sunny-pop.mp3", "music/calm-glow.mp3", "music/bold-beat.mp3"])
        expect(store.upload).toHaveBeenCalledWith("media", "music/calm-glow.mp3", Buffer.from("calm-glow"), "audio/mpeg")
        expect(logger.info).toHaveBeenCalledWith(VideoMusicLogEvent.Uploaded, { bucket: "media", paths: written })
    })

    it("fails with the storage error of the bed the store refused", async () => {
        const store = mock<MusicStore>()
        store.upload.mockResolvedValue({ error: new Error("bucket missing") })

        await expect(new VideoMusicService(store, mock<Logger>()).upload(dir)).rejects.toMatchObject({
            code: VideoMusicErrorCode.StorageFailed,
            params: { path: "music/sunny-pop.mp3" },
        })
    })
})

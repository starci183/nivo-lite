import { mock } from "@starci/jest-preset"
import type { VideoMusicService } from "@modules/domain/video-music"
import { UploadSeedMediaCli } from "./upload.cli"

describe("UploadSeedMediaCli", () => {
    it("hands the seed folder to the music capability once", async () => {
        const music = mock<VideoMusicService>()
        music.upload.mockResolvedValue(["music/calm-glow.mp3"])

        await expect(new UploadSeedMediaCli(music).run([], { dir: "seed" })).resolves.toBeUndefined()

        expect(music.upload).toHaveBeenCalledTimes(1)
        expect(music.upload).toHaveBeenCalledWith("seed")
    })

    it("reads the dir option as given", () => {
        expect(new UploadSeedMediaCli(mock<VideoMusicService>()).parseDir("seed")).toBe("seed")
    })
})

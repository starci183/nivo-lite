import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { VideoMusicService } from "@modules/domain/video-music"
import { UploadSeedMediaCli } from "./upload.cli"

const build = async () => {
    const music = mock<VideoMusicService>()
    const moduleRef = await Test.createTestingModule({
        providers: [UploadSeedMediaCli, { provide: VideoMusicService, useValue: music }],
    }).compile()
    return { cli: moduleRef.get(UploadSeedMediaCli), music }
}

describe("UploadSeedMediaCli", () => {
    it("hands the seed folder to the music capability once", async () => {
        const { cli, music } = await build()
        music.upload.mockResolvedValue(["music/calm-glow.mp3"])

        await expect(cli.run([], { dir: "seed" })).resolves.toBeUndefined()

        expect(music.upload).toHaveBeenCalledTimes(1)
        expect(music.upload).toHaveBeenCalledWith("seed")
    })

    it("reads the dir option as given", async () => {
        const { cli } = await build()
        expect(cli.parseDir("seed")).toBe("seed")
    })
})

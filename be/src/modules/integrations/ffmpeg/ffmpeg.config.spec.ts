import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseFfmpegConfig } from "./ffmpeg.config"

const FFMPEG_CONFIG = Symbol("FFMPEG_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: FFMPEG_CONFIG, useFactory: parseFfmpegConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(FFMPEG_CONFIG)
}

describe("parseFfmpegConfig", () => {
    it("lowers priority on linux unless the flag says otherwise", async () => {
        await expect(read({})).resolves.toEqual({ nice: process.platform === "linux" })
        await expect(read({ VIDEO_FFMPEG_NICE: "true" })).resolves.toEqual({ nice: true })
        await expect(read({ VIDEO_FFMPEG_NICE: "false" })).resolves.toEqual({ nice: false })
    })
})

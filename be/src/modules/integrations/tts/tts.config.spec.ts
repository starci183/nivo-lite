import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseTtsConfig } from "./tts.config"

const TTS_CONFIG = Symbol("TTS_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: TTS_CONFIG, useFactory: parseTtsConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(TTS_CONFIG)
}

describe("parseTtsConfig", () => {
    it("speaks with edge and writes under the default directories", async () => {
        await expect(read({})).resolves.toEqual({
            provider: "edge",
            cacheDir: "/var/cache/nivo-video",
            workDir: join(tmpdir(), "nivo-video"),
            minGapMs: 700,
        })
        await expect(read({ VIDEO_TTS_PROVIDER: "edge" })).resolves.toMatchObject({ provider: "edge" })
    })

    it("can be switched off and pointed at declared directories", async () => {
        await expect(
            read({
                VIDEO_TTS_PROVIDER: "none",
                VIDEO_CACHE_DIR: "/cache",
                VIDEO_WORK_DIR: "/work",
                VIDEO_TTS_MIN_GAP_MS: "1200",
            }),
        ).resolves.toEqual({
            provider: "none",
            cacheDir: "/cache",
            workDir: "/work",
            minGapMs: 1200,
        })
    })
})

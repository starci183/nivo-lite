import fsPromises, { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TtsErrorCode } from "./errors/tts.error"
import { TtsClient } from "./tts.client"
import { TTS_OPTIONS } from "./tts.decorators"
import { TtsLogEvent } from "./tts.log-events"
import type { TtsOptions } from "./tts.options"
import { TtsService } from "./tts.service"

const AUDIO = Buffer.alloc(900, 7)

const signal = new AbortController().signal

const wait = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
        AbortSignal.timeout(ms).addEventListener("abort", () => resolve(), { once: true })
    })

const sandbox = async (): Promise<{ cacheDir: string; workDir: string }> => {
    const root = await mkdtemp(join(tmpdir(), "nivo-tts-spec-"))
    return { cacheDir: join(root, "cache"), workDir: join(root, "work") }
}

const build = async (overrides: Partial<TtsOptions> = {}) => {
    const client = mock<TtsClient>({ id: "edge" })
    client.synthesize.mockResolvedValue(AUDIO)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TtsService,
            { provide: TtsClient, useValue: client },
            {
                provide: TTS_OPTIONS,
                useValue: builder<TtsOptions>({ provider: "edge", cacheDir: "cache", workDir: "work", minGapMs: 0 })(
                    overrides,
                ),
            },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T00:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { tts: moduleRef.get(TtsService), client, logger }
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe("TtsService / without a provider", () => {
    it("is off, names no provider and refuses to speak", async () => {
        const { tts, client } = await build({ provider: "none" })

        expect(tts.enabled).toBe(false)
        expect(tts.providerId).toBe("none")
        await expect(tts.clip("Hello", "voice", 0, signal)).rejects.toMatchObject({ code: TtsErrorCode.Disabled })
        expect(client.synthesize).not.toHaveBeenCalled()
    })
})

describe("TtsService / clip", () => {
    it("synthesizes once, stores the clip and answers it from the cache the second time", async () => {
        const dirs = await sandbox()
        const { tts, client } = await build(dirs)

        const first = await tts.clip("Hello", "vi-VN-HoaiMyNeural", 5, signal)
        const second = await tts.clip("Hello", "vi-VN-HoaiMyNeural", 5, signal)

        expect(tts.enabled).toBe(true)
        expect(tts.providerId).toBe("edge")
        expect(first).toEqual({ file: expect.stringContaining(dirs.cacheDir), cached: false, provider: "edge" })
        expect(second).toEqual({ file: first.file, cached: true, provider: "edge" })
        expect(client.synthesize).toHaveBeenCalledTimes(1)
        expect(client.synthesize).toHaveBeenCalledWith(
            { text: "Hello", voice: "vi-VN-HoaiMyNeural", ratePct: 5 },
            signal,
        )
        expect((await readdir(dirs.cacheDir)).filter((name) => name.endsWith(".mp3"))).toHaveLength(1)
    })
    it("keeps a clip per text, voice and rate", async () => {
        const { tts, client } = await build(await sandbox())

        const clips = [
            await tts.clip("Hello", "a", 0, signal),
            await tts.clip("Hello", "b", 0, signal),
            await tts.clip("Hello", "a", 1, signal),
            await tts.clip("Bye", "a", 0, signal),
        ]

        expect(new Set(clips.map((clip) => clip.file)).size).toBe(4)
        expect(client.synthesize).toHaveBeenCalledTimes(4)
    })
    it("waits the gap between two requests of the provider", async () => {
        const { tts, client } = await build({ ...(await sandbox()), minGapMs: 5 })

        await Promise.all([tts.clip("One", "v", 0, signal), tts.clip("Two", "v", 0, signal)])

        expect(client.synthesize).toHaveBeenCalledTimes(2)
    })
    it("lets the next clip go on after one failed", async () => {
        const { tts, client } = await build(await sandbox())
        const failure = new Error("throttled")
        client.synthesize.mockRejectedValueOnce(failure)

        const [first, second] = await Promise.allSettled([
            tts.clip("One", "v", 0, signal),
            tts.clip("Two", "v", 0, signal),
        ])

        expect(first).toEqual({ status: "rejected", reason: failure })
        expect(second.status).toBe("fulfilled")
    })
    it("rethrows a failure to look in the cache that is not a missing file", async () => {
        const { tts } = await build(await sandbox())
        const denied = Object.assign(new Error("denied"), { code: "EACCES" })
        jest.spyOn(fsPromises, "stat").mockRejectedValueOnce(denied)

        await expect(tts.clip("Hello", "v", 0, signal)).rejects.toBe(denied)
    })
})

describe("TtsService / clip", () => {
    it("writes the clip into the work directory when the cache directory cannot be written", async () => {
        const dirs = await sandbox()
        const { tts, logger } = await build(dirs)
        const refusal = new Error("read-only volume")
        jest.spyOn(fsPromises, "mkdir").mockRejectedValueOnce(refusal)

        const clip = await tts.clip("Hello", "v", 0, signal)

        expect(clip.cached).toBe(false)
        expect(clip.file).toContain(dirs.workDir)
        expect(logger.error).toHaveBeenCalledWith(TtsLogEvent.CacheWriteFailed, refusal)
    })
    it("drops the oldest clips beyond 400", async () => {
        const dirs = await sandbox()
        await mkdir(dirs.cacheDir, { recursive: true })
        for (let index = 0; index < 401; index++) {
            const file = join(dirs.cacheDir, `old-${index}.mp3`)
            await writeFile(file, "x")
            await utimes(file, 1_000 + index, 1_000 + index)
        }
        const { tts } = await build(dirs)

        await tts.clip("Fresh", "v", 0, signal)
        await wait(300)

        const names = await readdir(dirs.cacheDir)
        expect(names.filter((name) => name.endsWith(".mp3"))).toHaveLength(400)
        expect(names).not.toContain("old-0.mp3")
        expect(names).toContain("old-400.mp3")
    })
    it("logs a cache that cannot be trimmed and carries on", async () => {
        const dirs = await sandbox()
        const { tts, logger } = await build(dirs)
        const refusal = new Error("cannot list")
        jest.spyOn(fsPromises, "readdir").mockRejectedValueOnce(refusal)

        await expect(tts.clip("Hello", "v", 0, signal)).resolves.toMatchObject({ cached: false })
        await wait(50)

        expect(logger.error).toHaveBeenCalledWith(TtsLogEvent.CachePruneFailed, refusal)
    })
})

describe("TtsService / onModuleDestroy", () => {
    it("frees the connection of the provider", async () => {
        const { tts, client } = await build()

        tts.onModuleDestroy()

        expect(client.close).toHaveBeenCalledTimes(1)
    })
})

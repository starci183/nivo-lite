import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { FfmpegErrorCode } from "./errors/ffmpeg.error"
import { FfmpegClient } from "./ffmpeg.client"
import { FFMPEG_OPTIONS } from "./ffmpeg.decorators"
import type { FfmpegOptions } from "./ffmpeg.options"

type Listener = (...args: Array<unknown>) => void

/** The smallest emitter the client listens to: handlers by event name. */
class FakeEmitter {
    private readonly handlers = new Map<string, Array<Listener>>()

    on(event: string, handler: Listener): this {
        this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
        return this
    }

    emit(event: string, ...args: Array<unknown>): void {
        for (const handler of this.handlers.get(event) ?? []) handler(...args)
    }
}

class FakeChild extends FakeEmitter {
    readonly stdout = new FakeEmitter()
    readonly stderr = new FakeEmitter()
    readonly kill = jest.fn()
}

interface Spawned {
    command: string
    args: ReadonlyArray<string>
    cwd: string
    child: FakeChild
}

interface SpawnOptions {
    cwd: string
}

const mockSpawned: Array<Spawned> = []

jest.mock("node:child_process", () => ({
    spawn: (command: string, args: ReadonlyArray<string>, options: SpawnOptions) => {
        const child = new FakeChild()
        mockSpawned.push({ command, args, cwd: options.cwd, child })
        return child
    },
}))

const optionsOf = builder<FfmpegOptions>({ nice: false })

const build = async (options: FfmpegOptions) => {
    const moduleRef = await Test.createTestingModule({
        providers: [FfmpegClient, { provide: FFMPEG_OPTIONS, useValue: options }],
    }).compile()
    return moduleRef.get(FfmpegClient)
}

const lastChild = (): FakeChild => {
    const spawned = mockSpawned[mockSpawned.length - 1]
    if (spawned === undefined) return new FakeChild()
    return spawned.child
}

beforeEach(() => {
    mockSpawned.length = 0
})

describe("FfmpegClient", () => {
    describe("run", () => {
        it("runs ffmpeg with the quiet arguments and answers what it printed", async () => {
            const ffmpeg = await build(optionsOf())
            const running = ffmpeg.run("ffmpeg", ["-i", "in.mp4", "out.mp4"], {
                signal: new AbortController().signal,
                cwd: "work",
            })
            lastChild().stderr.emit("data", Buffer.from("frame done"))
            lastChild().stdout.emit("data", Buffer.from("ignored"))
            lastChild().emit("close", 0)

            await expect(running).resolves.toEqual({ stdout: "ignored", stderr: "frame done" })

            expect(mockSpawned[0]).toMatchObject({
                command: "ffmpeg",
                args: ["-hide_banner", "-nostdin", "-y", "-i", "in.mp4", "out.mp4"],
                cwd: "work",
            })
        })

        it("lowers the priority with nice unless the run is urgent", async () => {
            const ffmpeg = await build(optionsOf({ nice: true }))
            const signal = new AbortController().signal
            const lowered = ffmpeg.run("ffmpeg", ["a"], { signal, cwd: "." })
            lastChild().emit("close", 0)
            await lowered
            const urgent = ffmpeg.run("ffprobe", ["b"], { signal, cwd: ".", urgent: true })
            lastChild().emit("close", 0)
            await urgent

            expect(mockSpawned[0]).toMatchObject({
                command: "nice",
                args: ["-n", "10", "ffmpeg", "-hide_banner", "-nostdin", "-y", "a"],
            })
            expect(mockSpawned[1]).toMatchObject({ command: "ffprobe", args: ["b"] })
        })

        it("reports the output time of a run that asks for the timeline", async () => {
            const ffmpeg = await build(optionsOf())
            const seconds: Array<number> = []
            const running = ffmpeg.run("ffmpeg", ["x"], {
                signal: new AbortController().signal,
                cwd: ".",
                onTime: (time) => seconds.push(time),
            })
            lastChild().stdout.emit(
                "data",
                Buffer.from("out_time_us=1500000\nprogress=continue\nout_time_us=2000000\n"),
            )
            lastChild().emit("close", 0)
            await running

            expect(seconds).toEqual([1.5, 2])
            expect(mockSpawned[0]?.args.slice(0, 6)).toEqual([
                "-hide_banner",
                "-nostdin",
                "-y",
                "-progress",
                "pipe:1",
                "-nostats",
            ])
        })

        it("fails with the end of stderr when the tool exits with an error", async () => {
            const ffmpeg = await build(optionsOf())
            const running = ffmpeg.run("ffmpeg", ["x"], { signal: new AbortController().signal, cwd: "." })
            lastChild().stderr.emit("data", Buffer.from("Invalid data"))
            lastChild().emit("close", 1)

            await expect(running).rejects.toMatchObject({
                code: FfmpegErrorCode.Failed,
                params: { tool: "ffmpeg", reason: "exit 1", stderr: "Invalid data" },
            })
        })

        it("fails when the tool was stopped by a signal", async () => {
            const ffmpeg = await build(optionsOf())
            const running = ffmpeg.run("ffmpeg", ["x"], { signal: new AbortController().signal, cwd: "." })
            lastChild().emit("close", null)

            await expect(running).rejects.toMatchObject({ params: { reason: "exit signal" } })
        })

        it("fails when the tool cannot start", async () => {
            const ffmpeg = await build(optionsOf())
            const cause = new Error("ENOENT")
            const running = ffmpeg.run("ffmpeg", ["x"], { signal: new AbortController().signal, cwd: "." })
            lastChild().emit("error", cause)

            await expect(running).rejects.toMatchObject({ params: { reason: "could not start" }, cause })
        })

        it("kills the tool when the caller aborts, and ignores what it does afterwards", async () => {
            const ffmpeg = await build(optionsOf())
            const abort = new AbortController()
            const running = ffmpeg.run("ffmpeg", ["x"], { signal: abort.signal, cwd: "." })
            const child = lastChild()
            abort.abort()

            await expect(running).rejects.toMatchObject({ params: { reason: "aborted" } })
            child.emit("close", 0)

            expect(child.kill).toHaveBeenCalledWith("SIGKILL")
        })

        it("kills the tool when it runs longer than its timeout", async () => {
            const ffmpeg = await build(optionsOf())
            const running = ffmpeg.run("ffmpeg", ["x"], {
                signal: new AbortController().signal,
                cwd: ".",
                timeoutMs: 1,
            })

            await expect(running).rejects.toMatchObject({ params: { reason: "timeout" } })
            expect(lastChild().kill).toHaveBeenCalledWith("SIGKILL")
        })
    })

    describe("probeDuration", () => {
        it("answers the duration ffprobe printed", async () => {
            const ffmpeg = await build(optionsOf())
            const measuring = ffmpeg.probeDuration("clip.mp3", new AbortController().signal)
            lastChild().stdout.emit("data", Buffer.from("12.5\n"))
            lastChild().emit("close", 0)

            await expect(measuring).resolves.toBe(12.5)
            expect(mockSpawned[0]).toMatchObject({
                command: "ffprobe",
                args: ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", "clip.mp3"],
            })
        })

        it("fails when ffprobe prints no usable duration", async () => {
            const ffmpeg = await build(optionsOf())
            const measuring = ffmpeg.probeDuration("clip.mp3", new AbortController().signal)
            lastChild().stdout.emit("data", Buffer.from("N/A"))
            lastChild().emit("close", 0)

            await expect(measuring).rejects.toMatchObject({ params: { tool: "ffprobe", reason: "no duration" } })
        })
    })
})

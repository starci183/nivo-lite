import { Test } from "@nestjs/testing"
import { ffmpegExecutablePaths, absoluteExecutablePath, validatedFfmpegOptions } from "./ffmpeg-executable.policy"

const SUBJECT = Symbol("ffmpeg-executable.policy")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { ffmpegExecutablePaths, absoluteExecutablePath, validatedFfmpegOptions } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./ffmpeg-executable.policy")>(SUBJECT)
}

describe("ffmpeg executable policy", () => {
    it("keeps the Alpine executables and priority wrapper absolute", async () => {
        const subject = await build()
        expect(subject.ffmpegExecutablePaths({ nice: true }, "linux", "x64")).toEqual({
            ffmpeg: "/usr/bin/ffmpeg",
            ffprobe: "/usr/bin/ffprobe",
            nice: "/bin/nice",
        })
    })

    it("supports both native Homebrew installation prefixes", async () => {
        const subject = await build()
        expect(subject.ffmpegExecutablePaths({ nice: false }, "darwin", "arm64")).toEqual({
            ffmpeg: "/opt/homebrew/bin/ffmpeg",
            ffprobe: "/opt/homebrew/bin/ffprobe",
            nice: undefined,
        })
        expect(subject.ffmpegExecutablePaths({ nice: true }, "darwin", "x64")).toEqual({
            ffmpeg: "/usr/local/bin/ffmpeg",
            ffprobe: "/usr/local/bin/ffprobe",
            nice: "/usr/bin/nice",
        })
    })

    it("supports Windows without a Unix priority-wrapper prerequisite", async () => {
        const subject = await build()
        expect(subject.ffmpegExecutablePaths({ nice: false }, "win32", "x64")).toEqual({
            ffmpeg: "C:/Program Files/ffmpeg/bin/ffmpeg.exe",
            ffprobe: "C:/Program Files/ffmpeg/bin/ffprobe.exe",
            nice: undefined,
        })
        expect(() => subject.ffmpegExecutablePaths({ nice: true }, "win32", "x64")).toThrow()
        expect(subject.ffmpegExecutablePaths({ nice: true, nicePath: "D:/tools/nice.exe" }, "win32", "x64").nice).toBe(
            "D:/tools/nice.exe",
        )
    })

    it("preserves explicit paths including spaces without parsing shell syntax", async () => {
        const subject = await build()
        expect(
            subject.ffmpegExecutablePaths({ nice: false, ffmpegPath: "D:\\My Tools\\ffmpeg.exe" }, "win32", "x64")
                .ffmpeg,
        ).toBe("D:\\My Tools\\ffmpeg.exe")
        expect(
            subject.ffmpegExecutablePaths({ nice: false, ffprobePath: "/opt/media/ffprobe" }, "linux", "x64").ffprobe,
        ).toBe("/opt/media/ffprobe")
    })

    it.each(["ffmpeg", "./ffmpeg", "../ffmpeg", ""])("refuses relative POSIX path %j", async (path) => {
        const subject = await build()
        expect(() => subject.absoluteExecutablePath(path, "linux", "ffmpeg")).toThrow()
    })

    it.each([
        "ffmpeg.exe",
        "C:ffmpeg.exe",
        "\\ffmpeg.exe",
        "\\\\server\\tools\\ffmpeg.exe",
        "C:/tools/ffmpeg\u0000.exe",
    ])("refuses relative, network and malformed Windows path %j", async (path) => {
        const subject = await build()
        expect(() => subject.absoluteExecutablePath(path, "win32", "ffmpeg")).toThrow()
    })
})

describe("ffmpeg configured executable validation", () => {
    it.each([true, false])("keeps optional paths and the resolved priority value %s", async (nice) => {
        const subject = await build()
        expect(subject.validatedFfmpegOptions({ nice }, "linux")).toEqual({
            nice,
            ffmpegPath: undefined,
            ffprobePath: undefined,
            nicePath: undefined,
        })
    })

    it.each<readonly [NodeJS.Platform, string]>([
        ["win32", "D:/Media Tools"],
        ["linux", "/opt/media tools"],
        ["darwin", "/opt/media tools"],
    ])("preserves declared paths and priority override on %s", async (platform, root) => {
        const subject = await build()
        expect(
            subject.validatedFfmpegOptions(
                {
                    nice: false,
                    ffmpegPath: `${root}/ffmpeg`,
                    ffprobePath: `${root}/ffprobe`,
                    nicePath: `${root}/nice`,
                },
                platform,
            ),
        ).toEqual({
            nice: false,
            ffmpegPath: `${root}/ffmpeg`,
            ffprobePath: `${root}/ffprobe`,
            nicePath: `${root}/nice`,
        })
    })

    it.each([
        { nice: false, ffmpegPath: "relative/program" },
        { nice: false, ffprobePath: "relative/program" },
        { nice: false, nicePath: "relative/program" },
    ])("refuses every relative declared path before starting a process: %p", async (options) => {
        const subject = await build()
        expect(() => subject.validatedFfmpegOptions(options, "linux")).toThrow()
    })
})

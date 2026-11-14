import { Test } from "@nestjs/testing"
import { SOUND_SPEC } from "@tests/fixtures/builders/video-compose.builder"
import type { ComposeSpec } from "@modules/domain/video-compose"
import { creatomateSourceOf, framesOf } from "./creatomate-source.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const SUBJECT = Symbol("creatomate-source.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { creatomateSourceOf, framesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./creatomate-source.policy")>(SUBJECT)
}

type Subject = Awaited<ReturnType<typeof build>>

const sourceOf = (subject: Subject, spec: ComposeSpec) => {
    const mapped = subject.creatomateSourceOf(spec)
    if (!mapped.ok) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: mapped.problems.join("; ") } })
    return mapped.source
}

const MINIMAL: ComposeSpec = { clips: [{ fileUrl: "https://store.test/c1.mp4" }], aspect: "16:9", resolution: "hd" }

describe("creatomateSourceOf > the whole spec", () => {
    it("maps clips, audio, logo and captions onto a RenderScript of the documented members", async () => {
        const subject = await build()
        expect(sourceOf(subject, SOUND_SPEC)).toEqual({
            output_format: "mp4",
            width: 720,
            height: 1280,
            frame_rate: 30,
            elements: [
                { type: "video", track: 1, time: 0, source: "https://store.test/c1.mp4?sig=a", fit: "cover" },
                {
                    type: "video",
                    track: 1,
                    source: "https://store.test/c2.mp4?sig=b",
                    fit: "cover",
                    trim_start: 0.5,
                    trim_duration: 3.5,
                    duration: 3.5,
                },
                { type: "audio", track: 2, time: 0, source: "https://store.test/voice.mp3?sig=c" },
                { type: "audio", track: 3, time: 0, source: "https://store.test/bed.mp3?sig=d", volume: "30%", duration: null, loop: true },
                {
                    type: "image",
                    track: 6,
                    time: 0,
                    duration: null,
                    source: "https://store.test/logo.png?sig=e",
                    fit: "contain",
                    width: "20%",
                    height: null,
                    x: "95%",
                    x_anchor: "100%",
                    y: "5%",
                    y_anchor: "0%",
                },
                {
                    type: "text",
                    track: 7,
                    time: 0,
                    duration: 2,
                    text: "Lotus",
                    x: "50%",
                    y: "85%",
                    width: "90%",
                    x_alignment: "50%",
                    font_size: "5 vmin",
                    fill_color: "#ffffff",
                    stroke_color: "#000000",
                },
            ],
        })
    })

    it("keeps the clips in order on one track, only the first with an explicit time", async () => {
        const subject = await build()
        const source = sourceOf(subject, {
            ...MINIMAL,
            clips: [{ fileUrl: "https://store.test/a.mp4" }, { fileUrl: "https://store.test/b.mp4" }, { fileUrl: "https://store.test/c.mp4" }],
        })

        expect(source.elements.map((element) => [element.source, element.track, element.time])).toEqual([
            ["https://store.test/a.mp4", 1, 0],
            ["https://store.test/b.mp4", 1, undefined],
            ["https://store.test/c.mp4", 1, undefined],
        ])
    })
})

describe("creatomateSourceOf > clips", () => {
    it("sets trim_start for a start offset alone and trim_duration plus duration for an end", async () => {
        const subject = await build()
        const source = sourceOf(subject, {
            ...MINIMAL,
            clips: [
                { fileUrl: "https://store.test/a.mp4", trimMs: { fromMs: 1500 } },
                { fileUrl: "https://store.test/b.mp4", trimMs: { fromMs: 0, toMs: 2250 } },
            ],
        })

        expect(source.elements[0]).toMatchObject({ trim_start: 1.5 })
        expect(source.elements[0]).not.toHaveProperty("trim_duration")
        expect(source.elements[1]).toMatchObject({ trim_duration: 2.25, duration: 2.25 })
        expect(source.elements[1]).not.toHaveProperty("trim_start")
    })

    it("sets no trim member for a whole clip", async () => {
        const subject = await build()
        const element = sourceOf(subject, MINIMAL).elements[0]

        expect(element).not.toHaveProperty("trim_start")
        expect(element).not.toHaveProperty("trim_duration")
    })
})

describe("creatomateSourceOf > audio", () => {
    it("sends a voice at its own loudness with no loop and a music bed looping over the timeline", async () => {
        const subject = await build()
        const source = sourceOf(subject, {
            ...MINIMAL,
            audio: [
                { fileUrl: "https://store.test/v.mp3", role: "voice", volume: 1 },
                { fileUrl: "https://store.test/m.mp3", role: "music", volume: 0.125 },
            ],
        })

        expect(source.elements.slice(1)).toEqual([
            { type: "audio", track: 2, time: 0, source: "https://store.test/v.mp3", volume: "100%" },
            { type: "audio", track: 3, time: 0, source: "https://store.test/m.mp3", volume: "12.5%", duration: null, loop: true },
        ])
    })

    it("sends no volume when the spec names none", async () => {
        const subject = await build()
        const source = sourceOf(subject, { ...MINIMAL, audio: [{ fileUrl: "https://store.test/v.mp3", role: "voice" }] })

        expect(source.elements[1]).not.toHaveProperty("volume")
    })
})

describe("creatomateSourceOf > logo corner", () => {
    it.each([
        ["top-left", { x: "5%", x_anchor: "0%", y: "5%", y_anchor: "0%" }],
        ["top-right", { x: "95%", x_anchor: "100%", y: "5%", y_anchor: "0%" }],
        ["bottom-left", { x: "5%", x_anchor: "0%", y: "95%", y_anchor: "100%" }],
        ["bottom-right", { x: "95%", x_anchor: "100%", y: "95%", y_anchor: "100%" }],
    ] as const)("puts a %s logo at its anchor", async (corner, position) => {
        const subject = await build()
        const source = sourceOf(subject, { ...MINIMAL, logo: { fileUrl: "https://store.test/l.png", corner } })

        expect(source.elements[1]).toMatchObject(position)
    })
})

describe("creatomateSourceOf > captions", () => {
    it("gives each caption its own track with time and duration in seconds, so overlapping captions are allowed", async () => {
        const subject = await build()
        const source = sourceOf(subject, {
            ...MINIMAL,
            captions: [
                { text: "One", fromMs: 0, toMs: 1500 },
                { text: "Two", fromMs: 1000, toMs: 2500 },
            ],
        })

        expect(source.elements.slice(1).map((element) => [element.text, element.track, element.time, element.duration])).toEqual([
            ["One", 7, 0, 1.5],
            ["Two", 8, 1, 1.5],
        ])
    })
})

describe("creatomateSourceOf > frame", () => {
    it.each([
        ["9:16", "sd", 480, 854],
        ["9:16", "hd", 720, 1280],
        ["9:16", "1080", 1080, 1920],
        ["16:9", "sd", 854, 480],
        ["16:9", "hd", 1280, 720],
        ["16:9", "1080", 1920, 1080],
        ["1:1", "sd", 480, 480],
        ["1:1", "hd", 720, 720],
        ["1:1", "1080", 1080, 1080],
    ] as const)("aspect %s at %s is %i x %i", async (aspect, resolution, width, height) => {
        const subject = await build()
        expect(subject.framesOf(aspect, resolution)).toEqual({ width, height })
        expect(sourceOf(subject, { ...MINIMAL, aspect, resolution })).toMatchObject({ width, height, output_format: "mp4" })
    })
})

describe("creatomateSourceOf > refusals", () => {
    const problemsOf = (subject: Subject, spec: ComposeSpec): ReadonlyArray<string> => {
        const mapped = subject.creatomateSourceOf(spec)
        return mapped.ok ? [] : mapped.problems
    }

    it("names the clip whose end is not after its start", async () => {
        const subject = await build()
        expect(problemsOf(subject, { ...MINIMAL, clips: [{ fileUrl: "https://store.test/a.mp4", trimMs: { fromMs: 2000, toMs: 2000 } }] })).toEqual([
            expect.stringContaining("clips.0.trimMs"),
        ])
    })

    it("names the caption whose end is not after its start", async () => {
        const subject = await build()
        expect(problemsOf(subject, { ...MINIMAL, captions: [{ text: "x", fromMs: 3000, toMs: 1000 }] })).toEqual([expect.stringContaining("captions.0")])
    })

    it("names the audio track whose volume is out of range", async () => {
        const subject = await build()
        expect(problemsOf(subject, { ...MINIMAL, audio: [{ fileUrl: "https://store.test/a.mp3", role: "voice", volume: 1.5 }] })).toEqual([
            expect.stringContaining("audio.0.volume"),
        ])
    })

    it("refuses a request over the 2 MB the API takes", async () => {
        const subject = await build()
        const long = "x".repeat(200)
        const captions = Array.from({ length: 60 }, (_unused, index) => ({ text: long, fromMs: index, toMs: index + 1 }))
        const clips = Array.from({ length: 20 }, () => ({ fileUrl: `https://store.test/${"p".repeat(2000)}.mp4` }))
        // 20 x 2 KB and 60 x 0.2 KB stay far under 2 MB: the cap is held by a spec the schema would never let through
        expect(problemsOf(subject, { ...MINIMAL, clips, captions })).toEqual([])
        const huge = Array.from({ length: 12_000 }, (_unused, index) => ({ text: long, fromMs: index, toMs: index + 1 }))
        expect(problemsOf(subject, { ...MINIMAL, captions: huge })).toEqual([expect.stringContaining("2 MB")])
    })
})

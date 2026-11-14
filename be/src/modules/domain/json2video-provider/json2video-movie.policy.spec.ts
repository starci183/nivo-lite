import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { J2V_WEBHOOK_EXPORTS } from "../../../tests/fixtures/builders/json2video.builder"
import { SOUND_SPEC } from "../../../tests/fixtures/builders/video-compose.builder"
import type { ComposeSpec } from "@modules/domain/video-compose"
import { JSON2VIDEO_MOVIE_MAX_BYTES } from "@modules/integrations/json2video"
import { canvasOf as canvasOfSubject, movieOf as movieOfSubject } from "./json2video-movie.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"


const SUBJECT = Symbol("json2video-movie.policy")

const build = async (): Promise<{ canvasOf: typeof canvasOfSubject; movieOf: typeof movieOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ canvasOf: typeof canvasOfSubject; movieOf: typeof movieOfSubject }>({ canvasOf: canvasOfSubject, movieOf: movieOfSubject }) }],
    }).compile()
    return moduleRef.get<{ canvasOf: typeof canvasOfSubject; movieOf: typeof movieOfSubject }>(SUBJECT)
}

const built = (movieOf: typeof movieOfSubject, spec: ComposeSpec, url: string | null = null) => {
    const result = movieOf(spec, url === null ? null : { url })
    if (!result.ok) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: result.reason } })
    return result.movie
}

describe("movieOf > the whole spec", () => {
    let movieOf: typeof movieOfSubject

    beforeAll(async () => {
        ;({ movieOf } = await build())
    })

    it("maps clips to scenes, tracks / logo / captions to movie elements, the callback to a webhook export", () => {
        const movie = built(movieOf, SOUND_SPEC, "https://example.com/webhook")

        expect(movie).toEqual({
            resolution: "custom",
            width: 720,
            height: 1280,
            scenes: [
                { elements: [{ type: "video", src: "https://store.test/c1.mp4?sig=a", resize: "cover", position: "center-center" }] },
                {
                    elements: [
                        {
                            type: "video",
                            src: "https://store.test/c2.mp4?sig=b",
                            seek: 0.5,
                            duration: 3.5,
                            resize: "cover",
                            position: "center-center",
                        },
                    ],
                },
            ],
            elements: [
                { type: "audio", src: "https://store.test/voice.mp3?sig=c" },
                { type: "audio", src: "https://store.test/bed.mp3?sig=d", volume: 0.3, duration: -2, loop: -1 },
                { type: "image", src: "https://store.test/logo.png?sig=e", position: "top-right", width: "20%", duration: -2 },
                {
                    type: "text",
                    text: "Lotus",
                    start: 0,
                    duration: 2,
                    settings: { "vertical-position": "bottom", "horizontal-position": "center" },
                },
            ],
            exports: J2V_WEBHOOK_EXPORTS,
        })
    })

    it("puts no export without a callback and no element without tracks, logo or captions", () => {
        const movie = built(movieOf, { clips: [{ fileUrl: "https://store.test/c1.mp4" }], aspect: "16:9", resolution: "1080" })

        expect(movie).toEqual({
            resolution: "custom",
            width: 1920,
            height: 1080,
            scenes: [{ elements: [{ type: "video", src: "https://store.test/c1.mp4", resize: "cover", position: "center-center" }] }],
            elements: [],
        })
    })

    it("keeps the clips in their order, one scene each", () => {
        const movie = built(movieOf, {
            clips: ["a", "b", "c"].map((name) => ({ fileUrl: `https://store.test/${name}.mp4` })),
            aspect: "9:16",
            resolution: "sd",
        })

        expect(movie.scenes.map((scene) => scene.elements[0]?.src)).toEqual([
            "https://store.test/a.mp4",
            "https://store.test/b.mp4",
            "https://store.test/c.mp4",
        ])
    })
})

describe("movieOf > the members", () => {
    let canvasOf: typeof canvasOfSubject
    let movieOf: typeof movieOfSubject

    beforeAll(async () => {
        ;({ canvasOf, movieOf } = await build())
    })

    const clip = { fileUrl: "https://store.test/c1.mp4" }
    const spec = (extra: Partial<ComposeSpec>): ComposeSpec => ({ clips: [clip], aspect: "9:16", resolution: "hd", ...extra })

    it.each([
        ["no trim", undefined, {}],
        ["a start only", { fromMs: 1500 }, { seek: 1.5 }],
        ["a start of zero and an end", { fromMs: 0, toMs: 2000 }, { duration: 2 }],
        ["a start and an end", { fromMs: 500, toMs: 4000 }, { seek: 0.5, duration: 3.5 }],
    ])("maps trim %s to seek / duration in seconds", (_name, trimMs, expected) => {
        const movie = built(movieOf, spec({ clips: [{ ...clip, ...(trimMs === undefined ? {} : { trimMs }) }] }))

        expect(movie.scenes[0]?.elements[0]).toEqual({
            type: "video",
            src: clip.fileUrl,
            ...expected,
            resize: "cover",
            position: "center-center",
        })
    })

    it("maps a voice to a plain audio element and a music bed to a looped one over the movie", () => {
        const movie = built(movieOf, 
            spec({
                audio: [
                    { fileUrl: "https://store.test/v.mp3", role: "voice", volume: 1 },
                    { fileUrl: "https://store.test/m.mp3", role: "music" },
                ],
            }),
        )

        expect(movie.elements).toEqual([
            { type: "audio", src: "https://store.test/v.mp3", volume: 1 },
            { type: "audio", src: "https://store.test/m.mp3", duration: -2, loop: -1 },
        ])
    })

    it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)("maps the logo corner %s to the same position preset", (corner) => {
        const movie = built(movieOf, spec({ logo: { fileUrl: "https://store.test/l.png", corner } }))

        expect(movie.elements[0]).toMatchObject({ type: "image", position: corner })
    })

    it("maps captions to text elements with start and duration in seconds", () => {
        const movie = built(movieOf, spec({ captions: [{ text: "One", fromMs: 1500, toMs: 4000 }, { text: "Two", fromMs: 4000, toMs: 4250 }] }))

        expect(movie.elements).toMatchObject([
            { type: "text", text: "One", start: 1.5, duration: 2.5 },
            { type: "text", text: "Two", start: 4, duration: 0.25 },
        ])
    })

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
    ] as const)("maps aspect %s at %s to %i x %i pixels", (aspect, resolution, width, height) => {
        expect(canvasOf(aspect, resolution)).toEqual({ width, height })
        expect(built(movieOf, spec({ aspect, resolution }))).toMatchObject({ resolution: "custom", width, height })
    })
})

describe("movieOf > refusals", () => {
    let movieOf: typeof movieOfSubject

    beforeAll(async () => {
        ;({ movieOf } = await build())
    })

    it("refuses a movie JSON over 2 MB, naming the members, before any request", () => {
        const long = `https://store.test/${"x".repeat(1900)}`
        const spec: ComposeSpec = {
            clips: Array.from({ length: 20 }, () => ({ fileUrl: long })),
            audio: Array.from({ length: 4 }, () => ({ fileUrl: long, role: "voice" as const })),
            captions: Array.from({ length: 60 }, () => ({ text: "y".repeat(200), fromMs: 0, toMs: 1000 })),
            aspect: "9:16",
            resolution: "hd",
        }
        const small = movieOf(spec, null)
        expect(small.ok).toBe(true)

        const huge = movieOf(spec, { url: `https://example.com/${"z".repeat(JSON2VIDEO_MOVIE_MAX_BYTES)}` })

        expect(huge).toMatchObject({ ok: false })
        expect(huge.ok ? "" : huge.reason).toContain("clips/audio/logo/captions")
    })
})

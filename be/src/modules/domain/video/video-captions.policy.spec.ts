import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { videoCaptions } from "./video-captions.policy"
import type { Scene, VideoSpec } from "./video-spec.policy"

const SUBJECT = Symbol("video-captions.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { videoCaptions } }],
    }).compile()
    return moduleRef.get<{ videoCaptions: typeof videoCaptions }>(SUBJECT)
}
const sceneOf = builder<Scene>({
    background: { type: "color", color: "#000000" },
    text: "",
    caption: "",
    voiceover: "",
    duration_s: 0,
    transition: "fade",
})
const specOf = builder<VideoSpec>({
    version: 1,
    aspect: "9:16",
    scenes: [],
    brand: { name: "Brand", primary: "#000000", secondary: "#ffffff", logo: null },
    music: null,
    voice: { enabled: true, name: "vi-VN-HoaiMyNeural", rate_pct: 0 },
    captions: true,
})

describe("videoCaptions", () => {
    it("uses the measured clips and the exact scene starts and voice lead of the audio mix", async () => {
        const subject = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ voiceover: "First" }), sceneOf({ voiceover: "Second" })] })
        expect(
            subject.videoCaptions(
                spec,
                [0, 3.75],
                [3.75, 4],
                [
                    { file: "a", seconds: 2.125 },
                    { file: "b", seconds: 3.5 },
                ],
                7750,
            ),
        ).toEqual({
            language: "vi-VN",
            text: "WEBVTT\n\n00:00:00.250 --> 00:00:02.375\nFirst\n\n00:00:04.000 --> 00:00:07.500\nSecond\n",
        })
    })

    it("escapes cue markup and arrows, preserves words and line breaks, and removes blank cue separators", async () => {
        const subject = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ voiceover: "<b>A & B</b> -->\r\n\r\nNext\u0000" })] })
        expect(subject.videoCaptions(spec, [0], [3], [{ file: "a", seconds: 2 }], 3000)?.text).toBe(
            "WEBVTT\n\n00:00:00.250 --> 00:00:02.250\n&lt;b&gt;A &amp; B&lt;/b&gt; --&gt;\nNext\uFFFD\n",
        )
    })

    it("clamps cue ends to the actual encoded video and omits cues outside it", async () => {
        const subject = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ voiceover: "Clipped" }), sceneOf({ voiceover: "Outside" })] })
        expect(
            subject.videoCaptions(
                spec,
                [0, 5],
                [5, 4],
                [
                    { file: "a", seconds: 4 },
                    { file: "b", seconds: 3 },
                ],
                1500,
            ),
        ).toEqual({ language: "vi-VN", text: "WEBVTT\n\n00:00:00.250 --> 00:00:01.500\nClipped\n" })
    })

    it("uses actual burned-in text boundaries when no speech clip exists, without guessing its language", async () => {
        const subject = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ text: "Headline", caption: "Caption", voiceover: "Failed audio" })] })
        expect(subject.videoCaptions(spec, [5], [3], [null], 8000)).toEqual({
            language: null,
            text: "WEBVTT\n\n00:00:05.150 --> 00:00:08.000\nHeadline\n\n00:00:05.200 --> 00:00:07.900\nCaption\n",
        })
        const fallback = specOf({ scenes: [sceneOf({ voiceover: "Visible fallback" })] })
        expect(subject.videoCaptions(fallback, [0], [3], [], 3000)?.text).toContain("Visible fallback")
        expect(subject.videoCaptions({ ...fallback, captions: false }, [0], [3], [], 3000)).toBeNull()
    })
})

describe("videoCaptions boundaries", () => {
    it("formats hour and millisecond boundaries and orders emitted cues by their actual start", async () => {
        const subject = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ voiceover: "Later" }), sceneOf({ voiceover: "Earlier" })] })
        expect(
            subject.videoCaptions(
                spec,
                [3599.75, 0],
                [2, 2],
                [
                    { file: "a", seconds: 1.001 },
                    { file: "b", seconds: 1 },
                ],
                3602000,
            )?.text,
        ).toBe("WEBVTT\n\n00:00:00.250 --> 00:00:01.250\nEarlier\n\n01:00:00.000 --> 01:00:01.001\nLater\n")
    })

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
        "emits no artifact for an unusable final duration %p",
        async (duration) => {
            const subject = await buildSubject()
            expect(subject.videoCaptions(specOf(), [], [], [], duration)).toBeNull()
        },
    )

    it("emits no empty, zero-duration, nonfinite or brand-only cues", async () => {
        const subject = await buildSubject()
        expect(subject.videoCaptions(specOf({ scenes: [sceneOf()] }), [], [], [], 3000)).toBeNull()
        const spec = specOf({
            scenes: [
                sceneOf({ voiceover: " " }),
                sceneOf({ voiceover: "Zero" }),
                sceneOf({ voiceover: "Bad" }),
                sceneOf({ voiceover: "Bad end" }),
            ],
        })
        expect(
            subject.videoCaptions(
                spec,
                [0, 1, Number.NaN, 2],
                [1, 1, 1, 1],
                [
                    { file: "a", seconds: 1 },
                    { file: "b", seconds: 0 },
                    { file: "c", seconds: 1 },
                    { file: "d", seconds: Number.POSITIVE_INFINITY },
                ],
                3000,
            ),
        ).toBeNull()
    })
})

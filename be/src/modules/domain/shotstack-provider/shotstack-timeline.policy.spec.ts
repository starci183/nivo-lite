import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ComposeSpec } from "@modules/domain/video-compose"
import { SOUND_SPEC } from "@tests/fixtures/builders/video-compose.builder"
import { SHOTSTACK_DOC_EDIT } from "@tests/fixtures/builders/shotstack.builder"
import { shotstackEditOf as shotstackEditOfSubject, shotstackProblemsOf as shotstackProblemsOfSubject, shotstackStatusOf as shotstackStatusOfSubject } from "./shotstack-timeline.policy"

const SUBJECT = Symbol("shotstack-timeline.policy")

describe("shotstack-timeline.policy built the way Nest does", () => {
    let shotstackEditOf: typeof shotstackEditOfSubject
    let shotstackProblemsOf: typeof shotstackProblemsOfSubject
    let shotstackStatusOf: typeof shotstackStatusOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ shotstackEditOf: typeof shotstackEditOfSubject; shotstackProblemsOf: typeof shotstackProblemsOfSubject; shotstackStatusOf: typeof shotstackStatusOfSubject }>({ shotstackEditOf: shotstackEditOfSubject, shotstackProblemsOf: shotstackProblemsOfSubject, shotstackStatusOf: shotstackStatusOfSubject }) }],
        }).compile()
        ;({ shotstackEditOf, shotstackProblemsOf, shotstackStatusOf } = moduleRef.get<{ shotstackEditOf: typeof shotstackEditOfSubject; shotstackProblemsOf: typeof shotstackProblemsOfSubject; shotstackStatusOf: typeof shotstackStatusOfSubject }>(SUBJECT))
    })

const MINIMAL: ComposeSpec = {
    clips: [{ fileUrl: "https://example.test/video.mp4", trimMs: { fromMs: 2000, toMs: 8000 } }],
    aspect: "16:9",
    resolution: "hd",
}

describe("shotstackEditOf", () => {
    it("maps one trimmed clip to the docs' shape: video asset with trim, start and length in seconds, mp4 output", () => {
        const edit = shotstackEditOf(MINIMAL, null)

        expect(edit.timeline.tracks).toEqual([
            { clips: [{ asset: { type: "video", src: "https://example.test/video.mp4", trim: 2 }, start: 0, length: 6 }] },
        ])
        expect(edit.output).toEqual({ format: "mp4", resolution: "hd", aspectRatio: "16:9" })
        expect(edit).not.toHaveProperty("callback")
        const doc = SHOTSTACK_DOC_EDIT.timeline.tracks[0]?.clips[0]
        expect(Object.keys(edit.timeline.tracks[0]?.clips[0] ?? {}).sort()).toEqual(Object.keys(doc ?? {}).sort())
    })

    it("plays the clips in order on one track: the first at 0, each next after the previous, an untrimmed end is auto", () => {
        const edit = shotstackEditOf(SOUND_SPEC, null)
        const clips = edit.timeline.tracks.find((track) => track.clips.some((clip) => clip.asset.type === "video"))?.clips

        expect(clips).toEqual([
            { asset: { type: "video", src: "https://store.test/c1.mp4?sig=a" }, start: 0, length: "auto" },
            { asset: { type: "video", src: "https://store.test/c2.mp4?sig=b", trim: 0.5 }, start: "auto", length: 3.5 },
        ])
    })

    it("puts the callback URL verbatim into the root callback", () => {
        const url = "https://nivo.test/api/connections/video-render/shotstack/c1/secret"

        expect(shotstackEditOf(MINIMAL, url).callback).toBe(url)
    })

    it("orders the tracks top to bottom: captions, logo, clips, voice, music", () => {
        const edit = shotstackEditOf(SOUND_SPEC, null)

        expect(edit.timeline.tracks.map((track) => track.clips[0]?.asset.type)).toEqual(["rich-text", "image", "video", "audio", "audio"])
    })

    it("maps audio by role: the voice plays its own length, the music bed runs to the end with its volume", () => {
        const audio = shotstackEditOf(SOUND_SPEC, null).timeline.tracks.filter((track) => track.clips[0]?.asset.type === "audio")

        expect(audio).toEqual([
            { clips: [{ asset: { type: "audio", src: "https://store.test/voice.mp3?sig=c" }, start: 0, length: "auto" }] },
            { clips: [{ asset: { type: "audio", src: "https://store.test/bed.mp3?sig=d", volume: 0.3 }, start: 0, length: "end" }] },
        ])
    })

})

describe("shotstackEditOf logo, captions and output", () => {
    it.each([
        ["top-left", "topLeft", 0.03, -0.03],
        ["top-right", "topRight", -0.03, -0.03],
        ["bottom-left", "bottomLeft", 0.03, 0.03],
        ["bottom-right", "bottomRight", -0.03, 0.03],
    ] as const)("places a %s logo at position %s with its margin offset", (corner, position, x, y) => {
        const edit = shotstackEditOf({ ...MINIMAL, logo: { fileUrl: "https://example.test/logo.png", corner } }, null)
        const logo = edit.timeline.tracks.find((track) => track.clips[0]?.asset.type === "image")?.clips[0]

        expect(logo).toEqual({
            asset: { type: "image", src: "https://example.test/logo.png" },
            start: 0,
            length: "end",
            fit: "contain",
            scale: 0.2,
            position,
            offset: { x, y },
        })
    })

    it("burns a caption as a rich-text clip between its two moments, sized by the resolution", () => {
        const edit = shotstackEditOf({ ...MINIMAL, captions: [{ text: "Lotus", fromMs: 1500, toMs: 4000 }], resolution: "1080" }, null)

        expect(edit.timeline.tracks[0]).toEqual({
            clips: [
                {
                    asset: {
                        type: "rich-text",
                        text: "Lotus",
                        font: { size: 64, color: "#ffffff", weight: 700 },
                        align: { horizontal: "center", vertical: "bottom" },
                        background: { color: "#000000", opacity: 0.5, wrap: true },
                    },
                    start: 1.5,
                    length: 2.5,
                    position: "bottom",
                },
            ],
        })
    })

    it("keeps overlapping captions on separate tracks and back-to-back captions on one", () => {
        const edit = shotstackEditOf(
            {
                ...MINIMAL,
                captions: [
                    { text: "b", fromMs: 1000, toMs: 3000 },
                    { text: "a", fromMs: 0, toMs: 2000 },
                    { text: "c", fromMs: 2000, toMs: 3000 },
                ],
            },
            null,
        )
        const lanes = edit.timeline.tracks.filter((track) => track.clips[0]?.asset.type === "rich-text")

        expect(lanes.map((lane) => lane.clips.map((clip) => (clip.asset.type === "rich-text" ? clip.asset.text : "")))).toEqual([["a", "c"], ["b"]])
    })

    it.each([
        ["9:16", "sd"],
        ["1:1", "1080"],
    ] as const)("sets the output aspect %s and the preset resolution %s", (aspect, resolution) => {
        expect(shotstackEditOf({ ...MINIMAL, aspect, resolution }, null).output).toEqual({ format: "mp4", resolution, aspectRatio: aspect })
    })

    it("sends no logo, caption or audio track a spec did not ask for", () => {
        expect(shotstackEditOf(MINIMAL, null).timeline.tracks).toHaveLength(1)
    })
})

describe("shotstackProblemsOf", () => {
    const firstClip: ComposeSpec["clips"][number] = { fileUrl: "https://example.test/a.mp4", trimMs: { fromMs: 0, toMs: 400_000 } }
    const long: ComposeSpec = {
        ...MINIMAL,
        clips: [firstClip, { fileUrl: "https://example.test/b.mp4", trimMs: { fromMs: 0, toMs: 300_000 } }],
    }

    it("refuses on the sandbox a timeline of known length over 10 minutes, naming the member", () => {
        expect(shotstackProblemsOf(long, "stage")).toEqual(["clips: 700000 ms is over the 600000 ms the sandbox environment renders"])
    })

    it("lets production take it, and the sandbox take a timeline of exactly 10 minutes", () => {
        expect(shotstackProblemsOf(long, "v1")).toEqual([])
        expect(shotstackProblemsOf({ ...long, clips: [firstClip, { fileUrl: "https://example.test/b.mp4", trimMs: { fromMs: 0, toMs: 200_000 } }] }, "stage")).toEqual([])
    })

    it("counts nothing for a clip with no end, whose length only its file knows", () => {
        expect(shotstackProblemsOf({ ...MINIMAL, clips: [{ fileUrl: "https://example.test/a.mp4" }] }, "stage")).toEqual([])
    })
})

describe("shotstackStatusOf", () => {
    it.each([
        ["queued", "queued"],
        ["fetching", "rendering"],
        ["preprocessing", "rendering"],
        ["rendering", "rendering"],
        ["generating", "rendering"],
        ["saving", "rendering"],
        ["done", "done"],
        ["failed", "failed"],
    ] as const)("maps the word %s to %s", (word, status) => {
        expect(shotstackStatusOf(word)).toBe(status)
    })
})
})

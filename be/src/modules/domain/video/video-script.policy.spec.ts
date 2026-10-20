import { Test } from "@nestjs/testing"
import { mediaKindOf, readScript, specOf } from "./video-script.policy"
import type { BrandKit } from "./video-script.policy"

const SUBJECT = Symbol("video-script.policy")
type Subject = { readScript: typeof readScript; mediaKindOf: typeof mediaKindOf; specOf: typeof specOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readScript, mediaKindOf, specOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"

const brand: BrandKit = {
    shopName: "Bakery",
    primary: "#ABC",
    secondary: "oops",
    logoPath: `${WORKSPACE}/logo.png`,
    musicTrack: "calm-glow",
    voice: "vi-VN-NamMinhNeural",
}

describe("readScript", () => {
    it("keeps the clean scenes, at most twelve", async () => {
        const subject = await build()

        const raw = Array.from({ length: 14 }, (_unused, index) => ({
            caption: ` Scene   ${index} `,
            voiceover: "Words",
            media: `${WORKSPACE}/${index}.jpg`,
        }))

        const scenes = subject.readScript(raw)

        expect(scenes).toHaveLength(12)
        expect(scenes[0]).toEqual({ caption: "Scene 0", voiceover: "Words", media: `${WORKSPACE}/0.jpg` })
    })

    it("drops what is not a scene or has nothing to show or say, and cuts long values", async () => {
        const subject = await build()

        const scenes = subject.readScript([
            "text",
            null,
            { caption: "", voiceover: "" },
            { caption: "x".repeat(400), voiceover: "y".repeat(900), media: "" },
            { voiceover: "Only voice", media: 12 },
        ])

        expect(scenes).toEqual([
            { caption: "x".repeat(160), voiceover: "y".repeat(420), media: null },
            { caption: "", voiceover: "Only voice", media: null },
        ])
    })

    it("reads nothing from what is not a list", async () => {
        const subject = await build()

        expect(subject.readScript({ caption: "a" })).toEqual([])
    })
})

describe("mediaKindOf", () => {
    it.each([
        ["clip.MP4", "video"],
        ["clip.mov", "video"],
        ["clip.webm", "video"],
        ["photo.jpg", "image"],
        ["photo.mp4.png", "image"],
    ] as const)("tells %s is a %s", async (path, kind) => {
        const subject = await build()

        expect(subject.mediaKindOf(path)).toBe(kind)
    })
})

describe("specOf", () => {
    it("builds cards in alternating colours for scenes without media and Ken Burns or clips for scenes with media", async () => {
        const subject = await build()

        const spec = subject.specOf(
            [
                { caption: "Welcome", voiceover: "Hello", media: null },
                { caption: "Look", voiceover: "", media: `${WORKSPACE}/a.jpg` },
                { caption: "Card two", voiceover: "", media: null },
                { caption: "Clip", voiceover: "", media: `${WORKSPACE}/b.mp4` },
                { caption: "Second photo", voiceover: "", media: `${WORKSPACE}/c.png` },
            ],
            "1:1",
            brand,
            "Shop",
        )

        expect(spec).toEqual({
            version: 1,
            aspect: "1:1",
            scenes: [
                {
                    background: { type: "gradient", from: "#aabbcc", to: "#0f172a" },
                    text: "Welcome",
                    caption: "",
                    voiceover: "Hello",
                    duration_s: 0,
                    transition: "fade",
                },
                {
                    background: { type: "image", src: `${WORKSPACE}/a.jpg`, motion: "pan-left" },
                    text: "",
                    caption: "Look",
                    voiceover: "",
                    duration_s: 0,
                    transition: "fade",
                },
                {
                    background: { type: "gradient", from: "#aabbcc", to: "#0f172a" },
                    text: "Card two",
                    caption: "",
                    voiceover: "",
                    duration_s: 0,
                    transition: "fade",
                },
                {
                    background: { type: "video", src: `${WORKSPACE}/b.mp4`, start_s: 0 },
                    text: "",
                    caption: "Clip",
                    voiceover: "",
                    duration_s: 0,
                    transition: "fade",
                },
                {
                    background: { type: "image", src: `${WORKSPACE}/c.png`, motion: "zoom-in" },
                    text: "",
                    caption: "Second photo",
                    voiceover: "",
                    duration_s: 0,
                    transition: "fade",
                },
            ],
            brand: { name: "Bakery", primary: "#aabbcc", secondary: "#0f172a", logo: `${WORKSPACE}/logo.png` },
            music: { track: "calm-glow", volume: 0.45 },
            voice: { enabled: true, name: "vi-VN-NamMinhNeural", rate_pct: 0 },
            captions: true,
        })
    })
})

describe("specOf", () => {
    it("swaps the gradient colours on the second card", async () => {
        const subject = await build()

        const spec = subject.specOf(
            [
                { caption: "One", voiceover: "", media: null },
                { caption: "Two", voiceover: "", media: null },
            ],
            "9:16",
            brand,
            "Shop",
        )

        expect(spec).toMatchObject({
            scenes: [
                { background: { from: "#aabbcc", to: "#0f172a" } },
                { background: { from: "#0f172a", to: "#aabbcc" } },
            ],
        })
    })

    it("adds the brand frame when the render is framed", async () => {
        const subject = await build()

        const spec = subject.specOf([{ caption: "One", voiceover: "", media: null }], "9:16", brand, "Shop", true)

        expect(spec).toMatchObject({ brand: { frame: true } })
    })

    it("falls back to the default shape, name, music and voice", async () => {
        const subject = await build()

        const spec = subject.specOf(
            [{ caption: "x".repeat(150), voiceover: "", media: null }],
            "4:3",
            { shopName: "", primary: "", secondary: "", logoPath: null, musicTrack: "loud", voice: "robot" },
            "Shop",
        )

        expect(spec).toMatchObject({
            aspect: "9:16",
            scenes: [{ text: "x".repeat(120) }],
            brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: null },
            music: null,
            voice: { name: "vi-VN-HoaiMyNeural" },
        })
    })
})

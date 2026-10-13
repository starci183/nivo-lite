import {
    aspectSize,
    estimateSceneSeconds,
    mediaPathOf,
    normaliseColor,
    validateVideoSpec,
    VIDEO_MAX_SCENES,
} from "./video-spec.policy"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const OTHER = "ffffffff-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const IMAGE = `${WORKSPACE}/photo.jpg`

const validSpec = {
    aspect: "9:16",
    scenes: [
        {
            background: { type: "color", color: "#fff" },
            text: "Hello",
            caption: "",
            voiceover: "",
            duration_s: 0,
            transition: "slide",
        },
    ],
    brand: { name: "Shop" },
}

describe("normaliseColor", () => {
    it.each([
        ["#ABC", "#aabbcc"],
        ["16A34A", "#16a34a"],
        ["  #0f172a ", "#0f172a"],
    ])("reads %s as %s", (input, expected) => {
        expect(normaliseColor(input)).toBe(expected)
    })

    it.each([[42], ["#12"], ["red"], [null]])("refuses %s", (input) => {
        expect(normaliseColor(input)).toBeNull()
    })
})

describe("mediaPathOf", () => {
    it("accepts a path inside the workspace folder", () => {
        expect(mediaPathOf(`/${IMAGE}`, WORKSPACE)).toBe(IMAGE)
    })

    it("accepts any workspace folder when none is pinned", () => {
        expect(mediaPathOf(IMAGE)).toBe(IMAGE)
    })

    it("reads the path out of a Storage URL", () => {
        const url = `https://project.supabase.co/storage/v1/object/sign/media/${WORKSPACE}/my%20photo.jpg?token=abc`
        expect(mediaPathOf(url, WORKSPACE)).toBe(`${WORKSPACE}/my photo.jpg`)
    })

    it("turns bytes that are not UTF-8 into the replacement character", () => {
        const url = `https://project.supabase.co/storage/v1/object/public/media/${WORKSPACE}/%ff.jpg`
        expect(mediaPathOf(url)).toContain("�")
    })

    it.each([
        ["a value that is not text", 12],
        ["a path of another workspace", `${OTHER}/photo.jpg`],
        ["a path outside any workspace folder", "photo.jpg"],
        ["an empty path", "  "],
        ["a path that climbs", `${WORKSPACE}/../${OTHER}/photo.jpg`],
        ["a path that stays in place", `${WORKSPACE}/./photo.jpg`],
        ["a path with an empty segment", `${WORKSPACE}//photo.jpg`],
        ["a path with a backslash", `${WORKSPACE}/a\\b.jpg`],
        ["a path with a control character", `${WORKSPACE}/a\u0001b.jpg`],
        ["a path that is too long", `${WORKSPACE}/${"a".repeat(300)}`],
        ["a URL that does not parse", "https://"],
        ["a URL of another bucket", `https://project.supabase.co/storage/v1/object/sign/videos/${WORKSPACE}/a.jpg`],
        [
            "a URL with a broken percent escape",
            `https://project.supabase.co/storage/v1/object/sign/media/${WORKSPACE}/a%zz.jpg`,
        ],
    ])("refuses %s", (_label, input) => {
        expect(mediaPathOf(input, WORKSPACE)).toBeNull()
    })
})

describe("estimateSceneSeconds", () => {
    it("takes the duration a scene names", () => {
        expect(estimateSceneSeconds({ caption: "", text: "", voiceover: "", duration_s: 7 })).toBe(7)
    })

    it("estimates from the longer of speaking and reading, between 3 and 15 seconds", () => {
        expect(estimateSceneSeconds({ caption: "", text: "", voiceover: "", duration_s: 0 })).toBe(3)
        expect(estimateSceneSeconds({ caption: "", text: "", voiceover: "x".repeat(140), duration_s: 0 })).toBe(10.8)
        expect(estimateSceneSeconds({ caption: "x".repeat(2000), text: "", voiceover: "", duration_s: 0 })).toBe(15)
    })
})

describe("aspectSize", () => {
    it.each([
        ["9:16", 1080, 1920],
        ["1:1", 1080, 1080],
        ["16:9", 1920, 1080],
    ] as const)("draws %s at %i x %i", (aspect, width, height) => {
        expect(aspectSize(aspect)).toEqual({ width, height })
    })
})

describe("validateVideoSpec", () => {
    it("normalises a valid spec", () => {
        const result = validateVideoSpec(validSpec, { workspaceId: WORKSPACE })

        expect(result).toEqual({
            ok: true,
            spec: {
                version: 1,
                aspect: "9:16",
                scenes: [
                    {
                        background: { type: "color", color: "#ffffff" },
                        text: "Hello",
                        caption: "",
                        voiceover: "",
                        duration_s: 0,
                        transition: "slide",
                    },
                ],
                brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: null },
                music: null,
                voice: { enabled: true, name: "vi-VN-HoaiMyNeural", rate_pct: 0 },
                captions: true,
            },
        })
    })

    it("keeps every kind of background, the music, the voice and the logo", () => {
        const result = validateVideoSpec(
            {
                aspect: "16:9",
                captions: false,
                scenes: [
                    { background: { type: "image", src: IMAGE, motion: "pan-right" }, duration_s: "4" },
                    { background: { type: "video", src: IMAGE, start_s: "12" }, duration_s: 15, transition: "none" },
                    { background: { type: "gradient", from: "#000", to: "#fff" }, voiceover: " hi\r\n" },
                ],
                brand: { name: "Shop", primary: "#abcdef", secondary: "#123456", logo: IMAGE },
                music: { track: "calm-glow", volume: 7 },
                voice: { enabled: false, name: "vi-VN-NamMinhNeural", rate_pct: "12.4" },
            },
            { workspaceId: WORKSPACE },
        )

        expect(result).toMatchObject({
            ok: true,
            spec: {
                aspect: "16:9",
                captions: false,
                scenes: [
                    {
                        background: { type: "image", src: IMAGE, motion: "pan-right" },
                        duration_s: 4,
                        transition: "fade",
                    },
                    { background: { type: "video", src: IMAGE, start_s: 12 }, duration_s: 15, transition: "none" },
                    { background: { type: "gradient", from: "#000000", to: "#ffffff" }, voiceover: "hi" },
                ],
                brand: { primary: "#abcdef", secondary: "#123456", logo: IMAGE },
                music: { track: "calm-glow", volume: 1 },
                voice: { enabled: false, name: "vi-VN-NamMinhNeural", rate_pct: 12 },
            },
        })
    })

    it("refuses what is not an object", () => {
        expect(validateVideoSpec("spec")).toEqual({ ok: false, errors: ["spec must be an object"] })
    })

    it("refuses a spec with neither scenes nor brand", () => {
        expect(validateVideoSpec({})).toEqual({
            ok: false,
            errors: ["scenes: at least one scene is required", "brand.name is required"],
        })
    })

    it("lists every problem of a bad spec", () => {
        const result = validateVideoSpec(
            {
                aspect: "4:3",
                scenes: [
                    "scene",
                    { background: "red", duration_s: 1 },
                    { background: { type: "image", src: `${OTHER}/a.jpg` } },
                    { background: { type: "gradient", from: "x", to: "y" } },
                    { background: { type: "color", color: "nope" } },
                ],
                brand: { logo: "elsewhere/logo.png" },
                music: { track: "loud" },
            },
            { workspaceId: WORKSPACE },
        )

        expect(result.ok).toBe(false)
        expect(result.ok ? [] : result.errors).toEqual(
            expect.arrayContaining([
                "aspect must be one of 9:16, 1:1, 16:9",
                "scenes[0]: must be an object",
                "scenes[0].background.type must be image, video, color or gradient",
                "scenes[1].background.type must be image, video, color or gradient",
                "scenes[1].duration_s must be 0 (automatic) or between 1.5 and 15",
                "scenes[2].background.src: must be a path or Storage URL inside this workspace's media folder",
                "scenes[3].background: gradient needs from and to as #RRGGBB",
                "scenes[4].background.color must be #RRGGBB",
                "brand.name is required",
                "brand.logo: must be a path or Storage URL inside this workspace's media folder",
                "music.track must be one of sunny-pop, calm-glow, bold-beat",
            ]),
        )
    })

    it("refuses music that is neither null nor an object", () => {
        const result = validateVideoSpec({ ...validSpec, music: "loud" })

        expect(result.ok ? [] : result.errors).toEqual(["music must be null or { track, volume }"])
    })

    it("refuses no scene, too many scenes and a video that is too long", () => {
        const scene = validSpec.scenes[0]
        const none = validateVideoSpec({ ...validSpec, scenes: [] })
        const many = validateVideoSpec({
            ...validSpec,
            scenes: Array.from({ length: VIDEO_MAX_SCENES + 1 }, () => scene),
        })
        const long = validateVideoSpec({
            ...validSpec,
            scenes: Array.from({ length: 7 }, () => ({ ...scene, duration_s: 15 })),
        })

        expect(none.ok ? [] : none.errors).toEqual(["scenes: at least one scene is required"])
        expect(many.ok ? [] : many.errors).toContain(`scenes: at most ${VIDEO_MAX_SCENES} scenes`)
        expect(long.ok ? [] : long.errors).toEqual(["video would be about 105 s; the maximum is 90 s"])
    })
})

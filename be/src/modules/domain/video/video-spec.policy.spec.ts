import { Test } from "@nestjs/testing"
import {
    aspectSize as aspectSizeImplementation,
    estimateSceneSeconds as estimateSceneSecondsImplementation,
    mediaPathOf as mediaPathOfImplementation,
    musicObjectPath as musicObjectPathImplementation,
    normaliseColor as normaliseColorImplementation,
    validateVideoSpec as validateVideoSpecImplementation,
    VIDEO_MAX_SCENES,
} from "./video-spec.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    aspectSize: typeof aspectSizeImplementation
    estimateSceneSeconds: typeof estimateSceneSecondsImplementation
    mediaPathOf: typeof mediaPathOfImplementation
    musicObjectPath: typeof musicObjectPathImplementation
    normaliseColor: typeof normaliseColorImplementation
    validateVideoSpec: typeof validateVideoSpecImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    aspectSize: aspectSizeImplementation,
                    estimateSceneSeconds: estimateSceneSecondsImplementation,
                    mediaPathOf: mediaPathOfImplementation,
                    musicObjectPath: musicObjectPathImplementation,
                    normaliseColor: normaliseColorImplementation,
                    validateVideoSpec: validateVideoSpecImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

describe("musicObjectPath", () => {
    it("puts a bed under the music folder of the media bucket", async () => {
        const subject = await buildSubject()

        expect(subject.musicObjectPath("calm-glow")).toBe("music/calm-glow.mp3")
    })
})

describe("normaliseColor", () => {
    it.each([
        ["#ABC", "#aabbcc"],
        ["16A34A", "#16a34a"],
        ["  #0f172a ", "#0f172a"],
    ])("reads %s as %s", async (input, expected) => {
        const subject = await buildSubject()

        expect(subject.normaliseColor(input)).toBe(expected)
    })

    it.each([[42], ["#12"], ["red"], [null]])("refuses %s", async (input) => {
        const subject = await buildSubject()

        expect(subject.normaliseColor(input)).toBeNull()
    })
})

describe("mediaPathOf", () => {
    it("accepts a path inside the workspace folder", async () => {
        const subject = await buildSubject()

        expect(subject.mediaPathOf(`/${IMAGE}`, WORKSPACE)).toBe(IMAGE)
    })

    it("accepts any workspace folder when none is pinned", async () => {
        const subject = await buildSubject()

        expect(subject.mediaPathOf(IMAGE)).toBe(IMAGE)
    })

    it("reads the path out of a legacy storage-api URL", async () => {
        const subject = await buildSubject()

        const url = `https://storage.example.org/storage/v1/object/sign/media/${WORKSPACE}/my%20photo.jpg?token=abc`
        expect(subject.mediaPathOf(url, WORKSPACE)).toBe(`${WORKSPACE}/my photo.jpg`)
    })

    it("reads the path out of a presigned S3 URL of the media bucket", async () => {
        const subject = await buildSubject()

        const url = `https://minio.example.org/nivo-media/${WORKSPACE}/my%20photo.jpg?X-Amz-Signature=abc`
        expect(subject.mediaPathOf(url, WORKSPACE)).toBe(`${WORKSPACE}/my photo.jpg`)
        expect(subject.mediaPathOf(`https://minio.example.org/nivo-videos/${WORKSPACE}/a.jpg`)).toBeNull()
    })

    it("turns bytes that are not UTF-8 into the replacement character", async () => {
        const subject = await buildSubject()

        const url = `https://storage.example.org/storage/v1/object/public/media/${WORKSPACE}/%ff.jpg`
        expect(subject.mediaPathOf(url)).toContain("�")
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
        ["a URL of another bucket", `https://storage.example.org/storage/v1/object/sign/videos/${WORKSPACE}/a.jpg`],
        [
            "a URL with a broken percent escape",
            `https://storage.example.org/storage/v1/object/sign/media/${WORKSPACE}/a%zz.jpg`,
        ],
    ])("refuses %s", async (_label, input) => {
        const subject = await buildSubject()

        expect(subject.mediaPathOf(input, WORKSPACE)).toBeNull()
    })
})

describe("estimateSceneSeconds", () => {
    it("takes the duration a scene names", async () => {
        const subject = await buildSubject()

        expect(subject.estimateSceneSeconds({ caption: "", text: "", voiceover: "", duration_s: 7 })).toBe(7)
    })

    it("estimates from the longer of speaking and reading, between 3 and 15 seconds", async () => {
        const subject = await buildSubject()

        expect(subject.estimateSceneSeconds({ caption: "", text: "", voiceover: "", duration_s: 0 })).toBe(3)
        expect(subject.estimateSceneSeconds({ caption: "", text: "", voiceover: "x".repeat(140), duration_s: 0 })).toBe(
            10.8,
        )
        expect(
            subject.estimateSceneSeconds({ caption: "x".repeat(2000), text: "", voiceover: "", duration_s: 0 }),
        ).toBe(15)
    })
})

describe("aspectSize", () => {
    it.each([
        ["9:16", 1080, 1920],
        ["1:1", 1080, 1080],
        ["16:9", 1920, 1080],
    ] as const)("draws %s at %i x %i", async (aspect, width, height) => {
        const subject = await buildSubject()

        expect(subject.aspectSize(aspect)).toEqual({ width, height })
    })
})

describe("validateVideoSpec", () => {
    it("normalises a valid spec", async () => {
        const subject = await buildSubject()

        const result = subject.validateVideoSpec(validSpec, { workspaceId: WORKSPACE })

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
})

describe("validateVideoSpec", () => {
    it("keeps every kind of background, the music, the voice and the logo", async () => {
        const subject = await buildSubject()

        const result = subject.validateVideoSpec(
            {
                aspect: "16:9",
                captions: false,
                scenes: [
                    { background: { type: "image", src: IMAGE, motion: "pan-right" }, duration_s: "4" },
                    {
                        background: { type: "video", src: IMAGE, start_s: "12" },
                        duration_s: 15,
                        transition: "none",
                    },
                    { background: { type: "gradient", from: "#000", to: "#fff" }, voiceover: " hi\r\n" },
                ],
                brand: { name: "Shop", primary: "#abcdef", secondary: "#123456", logo: IMAGE, frame: true },
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
                brand: { primary: "#abcdef", secondary: "#123456", logo: IMAGE, frame: true },
                music: { track: "calm-glow", volume: 1 },
                voice: { enabled: false, name: "vi-VN-NamMinhNeural", rate_pct: 12 },
            },
        })
    })

    it("refuses what is not an object", async () => {
        const subject = await buildSubject()

        expect(subject.validateVideoSpec("spec")).toEqual({ ok: false, errors: ["spec must be an object"] })
    })

    it("refuses a spec with neither scenes nor brand", async () => {
        const subject = await buildSubject()

        expect(subject.validateVideoSpec({})).toEqual({
            ok: false,
            errors: ["scenes: at least one scene is required", "brand.name is required"],
        })
    })
})

describe("validateVideoSpec", () => {
    it("lists every problem of a bad spec", async () => {
        const subject = await buildSubject()

        const result = subject.validateVideoSpec(
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

    it("refuses music that is neither null nor an object", async () => {
        const subject = await buildSubject()

        const result = subject.validateVideoSpec({ ...validSpec, music: "loud" })

        expect(result.ok ? [] : result.errors).toEqual(["music must be null or { track, volume }"])
    })
})

describe("validateVideoSpec", () => {
    it("refuses no scene, too many scenes and a video that is too long", async () => {
        const subject = await buildSubject()

        const scene = validSpec.scenes[0]
        const none = subject.validateVideoSpec({ ...validSpec, scenes: [] })
        const many = subject.validateVideoSpec({
            ...validSpec,
            scenes: Array.from({ length: VIDEO_MAX_SCENES + 1 }, () => scene),
        })
        const long = subject.validateVideoSpec({
            ...validSpec,
            scenes: Array.from({ length: 7 }, () => ({ ...scene, duration_s: 15 })),
        })

        expect(none.ok ? [] : none.errors).toEqual(["scenes: at least one scene is required"])
        expect(many.ok ? [] : many.errors).toContain(`scenes: at most ${VIDEO_MAX_SCENES} scenes`)
        expect(long.ok ? [] : long.errors).toEqual(["video would be about 105 s; the maximum is 90 s"])
    })
})

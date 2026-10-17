import { Test } from "@nestjs/testing"
import { VideoErrorCode } from "./errors/video.error"
import {
    aacArgs,
    audioFilterOf,
    captionCues,
    crossfadesOf,
    finalArgs,
    loudnessMeasureArgs,
    loudnessOf,
    loudnessReport,
    posterArgs,
    premixArgs,
    sceneArgs,
    sceneLengths,
    startsOf,
} from "./render-plan.policy"
import type { SceneClip } from "./render-plan.policy"
import type { Scene, Transition, VideoSpec } from "./video-spec.policy"

const SUBJECT = Symbol("render-plan.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    aacArgs,
                    audioFilterOf,
                    captionCues,
                    crossfadesOf,
                    finalArgs,
                    loudnessMeasureArgs,
                    loudnessOf,
                    loudnessReport,
                    posterArgs,
                    premixArgs,
                    sceneArgs,
                    sceneLengths,
                    startsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./render-plan.policy")>(SUBJECT)
}

const PRINTED = `
[Parsed_loudnorm_0 @ 0x1] {
    "input_i" : "-23.57",
    "input_tp" : "-4.10",
    "input_lra" : "6.30",
    "input_thresh" : "-34.00",
    "output_i" : "-14.00",
    "target_offset" : "0.50"
}`

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const IMAGE = `${WORKSPACE}/photo.jpg`
const POSTER = ["-ss", "1.200", "-i", "out.mp4", "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", "poster.jpg"]
const SIZE = { width: 1080, height: 1920 }

const sceneOf = (overrides: Partial<Scene> = {}): Scene => ({
    background: { type: "color", color: "#112233" },
    text: "",
    caption: "",
    voiceover: "",
    duration_s: 0,
    transition: "fade",
    ...overrides,
})

const clipOf = (scene: Scene, assets: ReadonlyMap<string, string> = new Map()): SceneClip => ({
    scene,
    length: 4,
    size: SIZE,
    assets,
    output: "seg0.mp4",
    threads: 2,
    gradientFile: "grad0.png",
})

const specOf = (overrides: Partial<VideoSpec> = {}): VideoSpec => ({
    version: 1,
    aspect: "9:16",
    scenes: [sceneOf({ background: { type: "color", color: "#ffffff" } })],
    brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: null },
    music: null,
    voice: { enabled: true, name: "vi-VN-HoaiMyNeural", rate_pct: 0 },
    captions: true,
    ...overrides,
})

describe("sceneLengths", () => {
    it("takes the longest of the scene duration and its voice, else the voice, else the estimate", async () => {
        const { sceneLengths } = await buildSubject()
        const scenes = [
            sceneOf({ duration_s: 5 }),
            sceneOf({ duration_s: 2 }),
            sceneOf({ voiceover: "Hello" }),
            sceneOf({ voiceover: "Hello" }),
            sceneOf({}),
        ]

        const lengths = sceneLengths(scenes, [
            null,
            { file: "a.mp3", seconds: 4 },
            { file: "b.mp3", seconds: 1 },
            null,
            null,
        ])

        expect(lengths[0]).toBe(5)
        expect(lengths[1]).toBeCloseTo(4.65)
        expect(lengths[2]).toBe(2.5)
        expect(lengths[3]).toBeGreaterThan(2.4)
        expect(lengths[4]).toBe(3)
    })

    it("treats a duration scene with no voice as just its duration", async () => {
        const { sceneLengths } = await buildSubject()
        expect(sceneLengths([sceneOf({ duration_s: 6 })], [null])).toEqual([6])
    })
})

describe("startsOf and crossfadesOf", () => {
    it("starts each scene where the one before ends", async () => {
        const { startsOf } = await buildSubject()
        expect(startsOf([3, 4, 5])).toEqual([0, 3, 7])
    })

    it("gives every scene the crossfade of its transition and the last none", async () => {
        const { crossfadesOf } = await buildSubject()
        const transitions: ReadonlyArray<Transition> = ["fade", "slide", "wipe", "zoom", "none", "fade"]
        const fades = crossfadesOf(transitions.map((transition) => sceneOf({ transition })))

        expect(fades).toEqual([
            { name: "fade", seconds: 0.5 },
            { name: "slideleft", seconds: 0.45 },
            { name: "wipeleft", seconds: 0.45 },
            { name: "zoomin", seconds: 0.5 },
            { name: "fade", seconds: 0.04 },
            { name: "fade", seconds: 0 },
        ])
    })
})

describe("sceneArgs", () => {
    it("draws a colour card from lavfi", async () => {
        const { sceneArgs } = await buildSubject()
        const args = sceneArgs(clipOf(sceneOf()))

        expect(args.slice(0, 4)).toEqual(["-f", "lavfi", "-i", "color=c=0x112233:s=1080x1920:r=30:d=4.000"])
        expect(args).toContain("libx264")
        expect(args.slice(-1)).toEqual(["seg0.mp4"])
    })

    it("scales the gradient picture the caller wrote", async () => {
        const { sceneArgs } = await buildSubject()
        const args = sceneArgs(clipOf(sceneOf({ background: { type: "gradient", from: "#000000", to: "#ffffff" } })))

        expect(args.slice(0, 6)).toEqual(["-loop", "1", "-framerate", "30", "-i", "grad0.png"])
        expect(args).toContain("scale=1080:1920:flags=bicubic,setsar=1,format=yuv420p")
    })

    it("loops and trims a clip from its start second", async () => {
        const { sceneArgs } = await buildSubject()
        const assets = new Map([[IMAGE, "asset0.mp4"]])
        const args = sceneArgs(clipOf(sceneOf({ background: { type: "video", src: IMAGE, start_s: 2.5 } }), assets))

        expect(args.slice(0, 6)).toEqual(["-ss", "2.500", "-stream_loop", "-1", "-i", "asset0.mp4"])
        expect(args.join(" ")).toContain("crop=1080:1920")
    })

    it.each([
        ["zoom-in", "z='1+0.14*on/120'"],
        ["zoom-out", "z='1.14-0.14*on/120'"],
        ["pan-left", "(1-on/120)"],
        ["pan-right", "*on/120'"],
        ["none", "z=1:"],
    ] as const)("moves a still image with %s", async (motion, expected) => {
        const { sceneArgs } = await buildSubject()
        const assets = new Map([[IMAGE, "asset0.jpg"]])
        const args = sceneArgs(clipOf(sceneOf({ background: { type: "image", src: IMAGE, motion } }), assets))

        expect(args.slice(0, 2)).toEqual(["-i", "asset0.jpg"])
        expect(args.join(" ")).toContain(expected)
        expect(args.join(" ")).toContain("zoompan=")
    })

    it("refuses an asset the caller did not download", async () => {
        const { sceneArgs } = await buildSubject()
        expect(() => sceneArgs(clipOf(sceneOf({ background: { type: "image", src: IMAGE, motion: "none" } })))).toThrow(
            expect.objectContaining({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `asset_missing: ${IMAGE}` },
            }),
        )
    })
})

describe("premixArgs", () => {
    const base = {
        voices: [
            { file: "v0.mp3", start: 0 },
            { file: "v1.mp3", start: 4.5 },
        ],
        musicVolume: 0.5,
        total: 10,
        output: "premix.wav",
    }

    it("places the voices and ducks the music under them", async () => {
        const { premixArgs } = await buildSubject()
        const args = premixArgs({ ...base, musicFile: "music.mp3" })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args.slice(0, 7)).toEqual(["-i", "v0.mp3", "-i", "v1.mp3", "-stream_loop", "-1", "-i"])
        expect(graph).toContain("adelay=250|250[v0]")
        expect(graph).toContain("adelay=4750|4750[v1]")
        expect(graph).toContain(
            "amix=inputs=2:normalize=0:dropout_transition=0,apad=whole_dur=10.000,atrim=0:10.000[voice]",
        )
        expect(graph).toContain("volume=0.275[music]")
        expect(graph).toContain("sidechaincompress")
        expect(args[args.indexOf("-map") + 1]).toBe("[mix]")
        expect(args.slice(-1)).toEqual(["premix.wav"])
    })

    it("mixes only the voices when there is no music", async () => {
        const { premixArgs } = await buildSubject()
        const args = premixArgs({ ...base, musicFile: null })

        expect(args[args.indexOf("-map") + 1]).toBe("[voice]")
        expect(args.join(" ")).not.toContain("sidechaincompress")
    })

    it("plays only the music louder when there is no voice", async () => {
        const { premixArgs } = await buildSubject()
        const args = premixArgs({ ...base, voices: [], musicFile: "music.mp3" })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args[args.indexOf("-map") + 1]).toBe("[music]")
        expect(graph).toContain("[0:a]aformat")
        expect(graph).toContain("volume=0.450[music]")
        expect(graph).toContain("afade=t=out:st=8.000:d=2")
    })

    it("writes a silent stereo track when there is neither", async () => {
        const { premixArgs } = await buildSubject()
        const args = premixArgs({ ...base, voices: [], musicFile: null, total: 1 })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args.slice(0, 4)).toEqual(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"])
        expect(graph).toBe("[0:a]atrim=0:1.000[silent]")
        expect(args[args.indexOf("-map") + 1]).toBe("[silent]")
    })
})

describe("loudness", () => {
    it("measures the premix with the target", async () => {
        const { loudnessMeasureArgs } = await buildSubject()
        expect(loudnessMeasureArgs("premix.wav")).toEqual([
            "-i",
            "premix.wav",
            "-af",
            "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ])
    })

    it("reads what loudnorm printed", async () => {
        const { loudnessOf } = await buildSubject()
        expect(loudnessOf(PRINTED)).toEqual({
            input_i: -23.57,
            input_tp: -4.1,
            input_lra: 6.3,
            input_thresh: -34,
            target_offset: 0.5,
        })
    })

    it.each([
        ["nothing printed", "no json here"],
        ["a silent mix", PRINTED.replace('"-23.57"', '"-inf"')],
        ["a mix below the gate", PRINTED.replace('"-23.57"', '"-80.00"')],
        ["a value that is no number", PRINTED.replace('"6.30"', '"n/a"')],
    ])("reads nothing from %s", async (_label, text) => {
        const { loudnessOf } = await buildSubject()
        expect(loudnessOf(text)).toBeNull()
    })

    it("applies the measured values linearly, or only resamples without them", async () => {
        const { audioFilterOf, loudnessOf } = await buildSubject()
        const measured = loudnessOf(PRINTED)

        expect(audioFilterOf(measured)).toEqual({
            filter:
                "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-23.57:measured_TP=-4.1:measured_LRA=6.3:" +
                "measured_thresh=-34:offset=0.5:linear=true,aresample=44100",
            normalised: true,
        })
        expect(audioFilterOf(null)).toEqual({ filter: "aresample=44100", normalised: false })
    })
})

describe("loudness", () => {
    it("encodes the premix to AAC with the filter", async () => {
        const { aacArgs } = await buildSubject()
        expect(aacArgs("premix.wav", "aresample=44100", "audio.m4a")).toEqual([
            "-i",
            "premix.wav",
            "-af",
            "aresample=44100",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "44100",
            "audio.m4a",
        ])
    })

    it("reports the target and what was measured", async () => {
        const { loudnessOf, loudnessReport } = await buildSubject()
        expect(loudnessReport(loudnessOf(PRINTED), true)).toEqual({
            target_lufs: -14,
            measured_lufs: -23.57,
            measured_tp: -4.1,
            normalised: true,
        })
        expect(loudnessReport(null, false)).toEqual({
            target_lufs: -14,
            measured_lufs: null,
            measured_tp: null,
            normalised: false,
        })
    })
})

describe("captionCues", () => {
    it("writes the brand over everything, the headline of a card and the caption of a picture", async () => {
        const { captionCues } = await buildSubject()
        const spec = specOf({
            scenes: [
                sceneOf({ text: "Dark card", background: { type: "color", color: "#101010" } }),
                sceneOf({ text: "Light card", background: { type: "color", color: "#fafafa" } }),
                sceneOf({ text: "Light gradient", background: { type: "gradient", from: "#ffffff", to: "#eeeeee" } }),
                sceneOf({ text: "Dark gradient", background: { type: "gradient", from: "#000000", to: "#111111" } }),
                sceneOf({
                    text: "On a picture",
                    background: { type: "image", src: IMAGE, motion: "none" },
                    caption: "Words",
                }),
            ],
        })

        const cues = captionCues(spec, [0, 4, 8, 12, 16], [4, 4, 4, 4, 4], [false, false, false, false, false])

        expect(cues[0]).toEqual({ start: 0, end: 20, text: "Shop", kind: "brand" })
        expect(cues.filter((cue) => cue.kind === "headline").map((cue) => cue.light)).toEqual([
            false,
            true,
            true,
            false,
            false,
        ])
        expect(cues[cues.length - 1]).toEqual({ start: 16.2, end: 19.9, text: "Words", kind: "caption" })
    })

    it("shows the spoken words when the voice failed, and nothing when it did not", async () => {
        const { captionCues } = await buildSubject()
        const spec = specOf({
            scenes: [sceneOf({ voiceover: "Spoken words" }), sceneOf({ voiceover: "Heard words" }), sceneOf({})],
        })

        const cues = captionCues(spec, [0, 3, 6], [3, 3, 3], [false, true, false])

        expect(cues.filter((cue) => cue.kind === "caption")).toEqual([
            { start: 0.2, end: 2.9, text: "Spoken words", kind: "caption" },
        ])
    })

    it("leaves out the brand cue without a name and the captions when they are off", async () => {
        const { captionCues } = await buildSubject()
        const spec = specOf({
            captions: false,
            brand: { name: "", primary: "#16a34a", secondary: "#0f172a", logo: null },
            scenes: [sceneOf({ caption: "Hidden" })],
        })

        expect(captionCues(spec, [0], [3], [false])).toEqual([])
    })
})

describe("captionCues", () => {
    it("takes a scene with no timing as starting at 0 and lasting 0", async () => {
        const { captionCues } = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ text: "Untimed" })] })

        expect(captionCues(spec, [], [], [])).toContainEqual({
            start: 0.15,
            end: 0,
            text: "Untimed",
            kind: "headline",
            light: false,
        })
    })

    it("keeps a short caption on screen for at least 0.8 seconds", async () => {
        const { captionCues } = await buildSubject()
        const spec = specOf({ scenes: [sceneOf({ caption: "Short" })] })

        expect(captionCues(spec, [0], [0.5], [false])).toContainEqual({
            start: 0.2,
            end: 0.8,
            text: "Short",
            kind: "caption",
        })
    })
})

describe("finalArgs", () => {
    const pass = {
        segments: ["seg0.mp4", "seg1.mp4", "seg2.mp4"],
        audioFile: "audio.m4a",
        starts: [0, 3, 6],
        crossfades: [
            { name: "fade", seconds: 0.5 },
            { name: "slideleft", seconds: 0.45 },
            { name: "fade", seconds: 0 },
        ],
        total: 9,
        threads: 4,
        fontsDir: "assets/fonts",
        output: "out.mp4",
    }

    it("crossfades the clips, burns the captions and keeps the prepared audio", async () => {
        const { finalArgs } = await buildSubject()
        const args = finalArgs({ ...pass, spec: specOf({ aspect: "16:9" }), logoFile: undefined })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args.slice(0, 6)).toEqual(["-threads", "1", "-i", "seg0.mp4", "-threads", "1"])
        expect(graph).toBe(
            "[0:v][1:v]xfade=transition=fade:duration=0.500:offset=3.000[x1];[x1][2:" +
                "v]xfade=transition=slideleft:duration=0.450:offset=6.000[x2];[x2]ass=subs.ass:" +
                "fontsdir=assets/fonts,format=yuv420p[v]",
        )
        expect(args).toEqual(expect.arrayContaining(["-map", "[v]", "3:a", "-t", "9.000", "-c:a", "copy", "out.mp4"]))
    })

    it.each([
        ["9:16", "overlay=49:96"],
        ["1:1", "overlay=49:38"],
    ] as const)("overlays the logo of a %s video", async (aspect, overlay) => {
        const { finalArgs } = await buildSubject()
        const args = finalArgs({ ...pass, spec: specOf({ aspect }), logoFile: "logo.png" })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args).toContain("logo.png")
        expect(graph).toContain("[4:v]scale=184:-1:force_original_aspect_ratio=decrease,format=rgba[lg]")
        expect(graph).toContain(`[x2][lg]${overlay}:shortest=1[lo]`)
        expect(graph).toContain("[lo]ass=subs.ass")
    })

    it("crossfades without a timing as an instant cut at the start", async () => {
        const { finalArgs } = await buildSubject()
        const args = finalArgs({ ...pass, crossfades: [], starts: [], spec: specOf(), logoFile: undefined })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(graph).toContain("[0:v][1:v]xfade=transition=fade:duration=0.000:offset=0.000[x1]")
    })

    it("encodes a single clip without a crossfade", async () => {
        const { finalArgs } = await buildSubject()
        const args = finalArgs({ ...pass, segments: ["seg0.mp4"], spec: specOf(), logoFile: undefined })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(graph).toBe("[0:v]ass=subs.ass:fontsdir=assets/fonts,format=yuv420p[v]")
    })
})

describe("posterArgs", () => {
    it("takes a still of the first scene, at most 720 wide", async () => {
        const { posterArgs } = await buildSubject()
        expect(posterArgs("out.mp4", 2, 9, 1080, "poster.jpg")).toEqual(POSTER)
        expect(posterArgs("out.mp4", 10, 0.5, 600, "poster.jpg")).toContain("0.400")
        expect(posterArgs("out.mp4", 10, 9, 600, "poster.jpg")).toContain("scale=600:-2")
    })
})

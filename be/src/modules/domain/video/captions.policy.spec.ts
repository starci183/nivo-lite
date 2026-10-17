import { Test } from "@nestjs/testing"
import { buildAss, keepTogether, luminance } from "./captions.policy"
import type { TextCue } from "./captions.policy"

const SUBJECT = Symbol("captions.policy")
type Subject = { keepTogether: typeof keepTogether; buildAss: typeof buildAss; luminance: typeof luminance }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { keepTogether, buildAss, luminance } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const UNITS = /^(min|kg|%|vnd)[.,!?]*$/iu

describe("keepTogether", () => {
    it("keeps a number with its unit, a short word with the next one and the last two words together", async () => {
        const subject = await build()

        expect(subject.keepTogether("Only 50 kg of rice is on the shelf today", UNITS)).toBe(
            String.raw`Only 50\hkg\hof\hrice is\hon\hthe shelf\htoday`,
        )
    })

    it("keeps a number with the number group that follows", async () => {
        const subject = await build()

        expect(subject.keepTogether("Call 1900 123 now please", UNITS)).toBe(String.raw`Call 1900\h123 now\hplease`)
    })

    it("leaves a single word and collapses the spaces", async () => {
        const subject = await build()

        expect(subject.keepTogether("  Hello  ", UNITS)).toBe("Hello")
    })

    it("lets a long caption break after a word that is not a number or a short word", async () => {
        const subject = await build()

        expect(subject.keepTogether("Fresh bread baked every morning", UNITS)).toBe(
            String.raw`Fresh bread baked every\hmorning`,
        )
    })
})

describe("luminance", () => {
    it("is 0 for black, 1 for white and in between for a colour", async () => {
        const subject = await build()

        expect(subject.luminance("#000000")).toBe(0)
        expect(subject.luminance("#ffffff")).toBeCloseTo(1, 5)
        expect(subject.luminance("#16a34a")).toBeGreaterThan(0.2)
        expect(subject.luminance("#16a34a")).toBeLessThan(0.5)
    })
})

describe("buildAss", () => {
    const cues: ReadonlyArray<TextCue> = [
        { start: 0, end: 10, text: "Shop {name}", kind: "brand" },
        { start: 0.15, end: 4, text: "Big\nheadline", kind: "headline", light: true },
        { start: 0.15, end: 4, text: "Dark headline", kind: "headline" },
        { start: 0.2, end: 3.9, text: "Caption with 5 min", kind: "caption" },
        { start: 5, end: 5, text: "Empty window", kind: "caption" },
        { start: 6, end: 8, text: "   ", kind: "caption" },
    ]

    it.each([
        ["9:16", "PlayResX: 1080", "PlayResY: 1920"],
        ["1:1", "PlayResX: 1080", "PlayResY: 1080"],
        ["16:9", "PlayResX: 1920", "PlayResY: 1080"],
    ] as const)("draws the %s script at its frame size", async (aspect, width, height) => {
        const subject = await build()

        const ass = subject.buildAss(aspect, cues, UNITS)

        expect(ass).toContain(width)
        expect(ass).toContain(height)
        expect(ass).toContain("WrapStyle: 0")
    })

    it("writes one dialogue per cue that shows something, with its own style, layer and time", async () => {
        const subject = await build()

        const lines = subject
            .buildAss("9:16", cues, UNITS)
            .split("\n")
            .filter((line) => line.startsWith("Dialogue:"))

        expect(lines).toEqual([
            "Dialogue: 1,0:00:00.00,0:00:10.00,Brand,,0,0,0,,Shop (name)",
            String.raw`Dialogue: 1,0:00:00.15,0:00:04.00,HeadlineDark,,0,0,0,,{\fad(220,180)}Big\hheadline`,
            String.raw`Dialogue: 1,0:00:00.15,0:00:04.00,Headline,,0,0,0,,{\fad(220,180)}Dark\hheadline`,
            String.raw`Dialogue: 2,0:00:00.20,0:00:03.90,Caption,,0,0,0,,{\fad(220,180)}Caption with 5\hmin`,
        ])
    })

    it("formats a time of more than an hour", async () => {
        const subject = await build()

        const ass = subject.buildAss("1:1", [{ start: 3661.5, end: 3700, text: "Late words", kind: "caption" }], UNITS)

        expect(ass).toContain("1:01:01.50,1:01:40.00")
    })

    it("turns a backslash of the text into a slash", async () => {
        const subject = await build()

        const ass = subject.buildAss("1:1", [{ start: 0, end: 1, text: String.raw`a\b`, kind: "brand" }], UNITS)

        expect(ass).toContain(",,a/b")
    })
})

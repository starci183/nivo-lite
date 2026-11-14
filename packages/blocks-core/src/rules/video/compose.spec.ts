import { COMPOSE_CAPTION_MAX, COMPOSE_CLIPS_MAX, captionsOf, composeSpecOf } from "./compose"

const MISMATCH = { problem: "the clips, their lengths and the headings of the scenes do not line up" }

describe("captionsOf", () => {
    it("times each heading by the running sum of the clips' lengths, in whole milliseconds", () => {
        expect(captionsOf(["M\u1edf \u0111\u1ea7u", "Gi\u1eefa", "K\u00eau g\u1ecdi"], [4, 6, 8])).toEqual([
            { text: "M\u1edf \u0111\u1ea7u", fromMs: 0, toMs: 4000 },
            { text: "Gi\u1eefa", fromMs: 4000, toMs: 10_000 },
            { text: "K\u00eau g\u1ecdi", fromMs: 10_000, toMs: 18_000 },
        ])
    })

    it("shows no caption for an empty heading but the scene still takes its time", () => {
        expect(captionsOf(["A", "   ", "C"], [4, 6, 8])).toEqual([
            { text: "A", fromMs: 0, toMs: 4000 },
            { text: "C", fromMs: 10_000, toMs: 18_000 },
        ])
    })

    it("folds white space and cuts a heading to the tool's longest", () => {
        const [only] = captionsOf([`  a \n b ${"x".repeat(COMPOSE_CAPTION_MAX)}`], [4])
        expect(only?.text.startsWith("a b x")).toBe(true)
        expect(only?.text.length).toBe(COMPOSE_CAPTION_MAX)
    })

    it("rounds a fractional length to the nearest millisecond so moments stay whole", () => {
        expect(captionsOf(["A", "B"], [4.0004, 6])).toEqual([
            { text: "A", fromMs: 0, toMs: 4000 },
            { text: "B", fromMs: 4000, toMs: 10_000 },
        ])
    })
})

describe("composeSpecOf", () => {
    const base = {
        clipUrls: ["https://f.example/1.mp4", "https://f.example/2.mp4"],
        clipSeconds: [4, 8],
        captions: ["Hoa h\u1ed3ng gi\u1ea3m 20%", "Nh\u1eafn tin \u0111\u1eb7t ngay"],
        voiceUrl: "https://f.example/voice.mp3",
        logoUrl: "https://cdn.example/logo.png",
        aspect: "9:16" as const,
        resolution: "hd" as const,
    }

    it("joins the clips in order with the voice, the logo and the captions", () => {
        expect(composeSpecOf(base)).toEqual({
            spec: {
                clips: [{ fileUrl: "https://f.example/1.mp4" }, { fileUrl: "https://f.example/2.mp4" }],
                audio: [{ fileUrl: "https://f.example/voice.mp3", role: "voice", volume: 1 }],
                logo: { fileUrl: "https://cdn.example/logo.png", corner: "top-right" },
                captions: [
                    { text: "Hoa h\u1ed3ng gi\u1ea3m 20%", fromMs: 0, toMs: 4000 },
                    { text: "Nh\u1eafn tin \u0111\u1eb7t ngay", fromMs: 4000, toMs: 12_000 },
                ],
                aspect: "9:16",
                resolution: "hd",
            },
        })
    })

    it("leaves out the audio and the logo when there are none, and the captions when every heading is empty", () => {
        expect(composeSpecOf({ ...base, voiceUrl: null, logoUrl: null, captions: ["", ""], aspect: "16:9" })).toEqual({
            spec: { clips: base.clipUrls.map((fileUrl) => ({ fileUrl })), aspect: "16:9", resolution: "hd" },
        })
    })

    it("says why nothing can be asked: no clips, too many, or inputs that do not line up", () => {
        expect(composeSpecOf({ ...base, clipUrls: [], clipSeconds: [], captions: [] })).toEqual({ problem: "no clips to join" })
        const many = Array.from({ length: COMPOSE_CLIPS_MAX + 1 }, (_, index) => `https://f.example/${String(index)}.mp4`)
        expect(composeSpecOf({ ...base, clipUrls: many, clipSeconds: many.map(() => 4), captions: many.map(() => "") })).toEqual({
            problem: `more than ${String(COMPOSE_CLIPS_MAX)} clips`,
        })
        expect(composeSpecOf({ ...base, clipSeconds: [4] })).toEqual(MISMATCH)
        expect(composeSpecOf({ ...base, captions: ["only one"] })).toEqual(MISMATCH)
    })
})

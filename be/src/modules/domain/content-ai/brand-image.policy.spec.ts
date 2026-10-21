import { Test } from "@nestjs/testing"
import { imageArgs, imageStylesOf, luminanceOf, wrapText } from "./brand-image.policy"
import type { ImageJob } from "./content-agent.contracts"

const kitOf = (hexes: ReadonlyArray<string>) => ({
    brandName: "H",
    colors: hexes.map((hex) => ({ name: hex, hex })),
    fonts: [],
    tone: "",
    address: "",
    imagery: [],
    avoid: [],
})

describe("luminanceOf", () => {
    it("is 1 for white and 0 for black", () => {
        expect(luminanceOf("#ffffff")).toBeCloseTo(1)
        expect(luminanceOf("#000000")).toBe(0)
    })
})

describe("imageStylesOf", () => {
    it("puts the lightest and darkest brand colors as canvas and ink, with the remaining color as accent", () => {
        const [light, dark] = imageStylesOf(kitOf(["#c2996b", "#5a4632", "#fbf7f1"]))

        expect(light).toEqual({ background: "#fbf7f1", ink: "#5a4632", accent: "#c2996b", photoLeft: false })
        expect(dark).toEqual({ background: "#5a4632", ink: "#fbf7f1", accent: "#c2996b", photoLeft: true })
    })

    it("falls back to warm neutrals without enough colors", () => {
        expect(imageStylesOf(null)[0]).toEqual({
            background: "#fbf7f1",
            ink: "#5a4632",
            accent: "#c2996b",
            photoLeft: false,
        })
        expect(imageStylesOf(kitOf(["#123456"]))[0].accent).toBe("#123456")
        expect(imageStylesOf(kitOf(["#ffffff", "#000000"]))[0].accent).toBe("#c2996b")
    })
})

describe("imageArgs", () => {
    const job: ImageJob = {
        photo: "photo-0",
        logo: "logo",
        headlineFile: "h.txt",
        sublineFile: "s.txt",
        boldFont: "/fonts/b.ttf",
        regularFont: "/fonts/r.ttf",
        style: { background: "#fbf7f1", ink: "#5a4632", accent: "#c2996b", photoLeft: false },
        output: "image-1.png",
    }

    it("composes canvas, photo, texts and logo into one frame", () => {
        const args = imageArgs(job)
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(args.slice(0, 5)).toEqual(["-y", "-f", "lavfi", "-i", "color=c=0xfbf7f1:s=1200x800:d=1"])
        expect(args).toContain("photo-0")
        expect(args).toContain("logo")
        expect(graph).toContain("[0:v][photo]overlay=600:0[canvas]")
        expect(graph).toContain("textfile=h.txt:fontcolor=0x5a4632")
        expect(graph).toContain("[2:v]scale=-1:96[logo]")
        expect(args.slice(-5)).toEqual(["-map", "[out]", "-frames:v", "1", "image-1.png"])
    })

    it("draws on the plain canvas without photo or logo, text on the right for a photo-left style", () => {
        const args = imageArgs({ ...job, photo: null, logo: null, style: { ...job.style, photoLeft: true } })
        const graph = args[args.indexOf("-filter_complex") + 1] ?? ""

        expect(graph.startsWith("[0:v]drawbox=x=664")).toBe(true)
        expect(args).toContain("[texted]")
    })
})

describe("wrapText", () => {
    it("wraps whole words at about the width", () => {
        expect(wrapText("Khoang lang cuoi tuan danh cho ban", 12)).toBe("Khoang lang\ncuoi tuan\ndanh cho ban")
        expect(wrapText("  ", 10)).toBe("")
    })
})

const SUBJECT = Symbol("brand-image.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { imageArgs, imageStylesOf, luminanceOf, wrapText } }],
    }).compile()
    return moduleRef.get<typeof import("./brand-image.policy")>(SUBJECT)
}

describe("brand-image policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.imageArgs).toBe(imageArgs)
    })
})

import { Test } from "@nestjs/testing"
import { inflateSync } from "node:zlib"
import { gradientPng } from "./gradient-png.policy"

const SUBJECT = Symbol("gradient-png.policy")
type Subject = { gradientPng: typeof gradientPng }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { gradientPng } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const SIDE = 96
const STRIDE = SIDE * 3 + 1

/** The raw RGB scanlines of the one IDAT chunk of a PNG. */
const pixelsOf = (png: Buffer): Buffer => {
    const length = png.readUInt32BE(33)
    return inflateSync(png.subarray(41, 41 + length))
}

const pixel = (raw: Buffer, x: number, y: number): Array<number> => {
    const at = y * STRIDE + 1 + x * 3
    return [raw[at] ?? -1, raw[at + 1] ?? -1, raw[at + 2] ?? -1]
}

describe("gradientPng", () => {
    it("writes a 96 x 96 RGB PNG", async () => {
        const subject = await build()

        const png = subject.gradientPng("#000000", "#ffffff", "vertical")

        expect([...png.subarray(0, 8)]).toEqual(SIGNATURE)
        expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR")
        expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([SIDE, SIDE, 8, 2])
        expect(png.subarray(png.length - 8, png.length - 4).toString("ascii")).toBe("IEND")
    })

    it("runs top to bottom in the vertical direction", async () => {
        const subject = await build()

        const raw = pixelsOf(subject.gradientPng("#000000", "#ffffff", "vertical"))

        expect(pixel(raw, 0, 0)).toEqual([0, 0, 0])
        expect(pixel(raw, 95, 0)).toEqual([0, 0, 0])
        expect(pixel(raw, 40, 95)).toEqual([255, 255, 255])
    })

    it("runs corner to corner in the diagonal direction", async () => {
        const subject = await build()

        const raw = pixelsOf(subject.gradientPng("#102030", "#f0e0d0", "diagonal"))

        expect(pixel(raw, 0, 0)).toEqual([16, 32, 48])
        expect(pixel(raw, 95, 95)).toEqual([240, 224, 208])
        expect(pixel(raw, 95, 0)).toEqual(pixel(raw, 0, 95))
    })
})

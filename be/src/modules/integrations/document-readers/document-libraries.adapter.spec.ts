import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import sharp from "sharp"
import { LibraryMissingError } from "./document-readers.contracts"
import { documentLibraries, pictureToolsOf } from "./document-libraries.adapter"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

/** True for the first bytes of a JPEG. */
const isJpeg = (bytes: Uint8Array): boolean => bytes[0] === 0xff && bytes[1] === 0xd8

describe("document libraries adapter", () => {
    it("turns a photo into a JPEG no larger than asked, and raw page pixels into one", async () => {
        const tools = pictureToolsOf(sharp)
        const jpeg = await tools.toJpeg(fixture("price-photo.jpg"), 16)
        expect(isJpeg(jpeg)).toBe(true)
        expect((await sharp(Buffer.from(jpeg)).metadata()).width).toBe(16)
        const raw = await tools.rawToJpeg(
            { data: new Uint8Array(4 * 4 * 3).fill(200), width: 4, height: 4, channels: 3 },
            100,
        )
        expect(isJpeg(raw)).toBe(true)
        expect((await sharp(Buffer.from(raw)).metadata()).width).toBe(4)
    })

    it("rejects bytes that are no picture", async () => {
        await expect(pictureToolsOf(sharp).toJpeg(new Uint8Array([1, 2, 3]), 10)).rejects.toThrow()
    })

    it("names the missing library when no HEIC decoder is installed, and lets the decoder refuse bytes that are no HEIC when it is", async () => {
        // The decoder is optional: the same spec holds on a machine with it and one without it.
        const installed = ((): boolean => {
            try {
                createRequire(__filename).resolve("heic-convert")
                return true
            } catch {
                return false
            }
        })()
        const outcome = await documentLibraries.heicToJpeg(new Uint8Array([0])).then(
            () => "decoded",
            (cause: unknown) => (cause instanceof LibraryMissingError ? "missing" : "refused"),
        )

        expect(outcome).toBe(installed ? "refused" : "missing")
    })
})

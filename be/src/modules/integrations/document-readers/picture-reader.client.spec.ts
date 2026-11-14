import { readFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { ok, refused } from "@modules/platform/primitives"
import { DocumentRefusalCode, DocumentWarningCode } from "./document-readers.contracts"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import type { DocumentLibraries, PageImage, TranscriptOutcome, Transcriber } from "./document-readers.contracts"
import { pictureToolsOf } from "./document-libraries.adapter"
import { readPicture, transcriptRefusal } from "./picture-reader.client"

const photo = new Uint8Array(readFileSync(join(__dirname, "fixtures", "price-photo.jpg")))

/** Real picture tools; no HEIC decoder, as on a server without the install. */
const libraries: DocumentLibraries = {
    wordToHtml: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
    openPdf: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
    pictures: () => Promise.resolve(pictureToolsOf(sharp)),
    heicToJpeg: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "heic-convert" } })),
}

/** A scripted transcriber that answers in turn and keeps what it was sent. */
const scripted = (...answers: ReadonlyArray<TranscriptOutcome>) => {
    const sent: Array<PageImage> = []
    const transcriber: Transcriber = {
        transcribe: (image) => {
            sent.push(image)
            return Promise.resolve(answers[sent.length - 1] ?? ok(""))
        },
    }
    return { transcriber, sent }
}

describe("picture reader", () => {
    it("sends a photo of a hand-written price list as ONE JPEG transcription call and marks its text transcribed", async () => {
        const { transcriber, sent } = scripted(ok("B\u1EA2NG GI\u00C1\nH\u1ED3ng \u0111\u1ECF | 35.000/b\u00F4ng"))
        const read = await readPicture("image", photo, libraries, transcriber)
        expect(read).toEqual({
            kind: "ok",
            value: {
                reader: "image",
                text: "B\u1EA2NG GI\u00C1\nH\u1ED3ng \u0111\u1ECF | 35.000/b\u00F4ng",
                pages: [{ kind: "page", label: "1", text: "B\u1EA2NG GI\u00C1\nH\u1ED3ng \u0111\u1ECF | 35.000/b\u00F4ng", transcribed: true }],
                pageCount: 1,
                sheetCount: null,
                transcribed: true,
                warnings: [{ code: DocumentWarningCode.PageTranscribed, place: "1", count: null }],
            },
        })
        expect(sent).toHaveLength(1)
        expect(sent[0]?.mime).toBe("image/jpeg")
        expect(sent[0]?.bytes[0]).toBe(0xff)
    })

    it("refuses a photo with nothing written on it, and one no transcriber can read", async () => {
        await expect(readPicture("image", photo, libraries, scripted(ok("")).transcriber)).resolves.toMatchObject({
            code: DocumentRefusalCode.NoText,
        })
        await expect(readPicture("image", photo, libraries, null)).resolves.toMatchObject({
            code: DocumentRefusalCode.TranscriptionUnavailable,
        })
        await expect(
            readPicture("image", photo, libraries, scripted(refused("no_credits")).transcriber),
        ).resolves.toMatchObject({
            code: DocumentRefusalCode.NoCredits,
        })
        await expect(
            readPicture("image", photo, libraries, scripted(refused("failed")).transcriber),
        ).resolves.toMatchObject({
            code: DocumentRefusalCode.TranscriptionUnavailable,
        })
    })

    it("refuses a HEIC photo as reader unavailable while no decoder is installed, and bytes that are no picture as unreadable", async () => {
        const { transcriber, sent } = scripted(ok("x"))
        await expect(readPicture("heic", photo, libraries, transcriber)).resolves.toMatchObject({
            code: DocumentRefusalCode.ReaderUnavailable,
        })
        await expect(readPicture("image", new Uint8Array([1, 2, 3]), libraries, transcriber)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
        expect(sent).toHaveLength(0)
    })

    it("decodes a HEIC photo once a decoder is installed", async () => {
        const withHeic: DocumentLibraries = { ...libraries, heicToJpeg: () => Promise.resolve(photo) }
        await expect(readPicture("heic", photo, withHeic, scripted(ok("Gi\u00E1 10k")).transcriber)).resolves.toMatchObject({
            kind: "ok",
            value: { reader: "heic", text: "Gi\u00E1 10k", transcribed: true },
        })
    })

    it("names the refusal of a document whose pictures gave no text", () => {
        expect(transcriptRefusal(null)).toBe(DocumentRefusalCode.NoText)
        expect(transcriptRefusal("no_credits")).toBe(DocumentRefusalCode.NoCredits)
        expect(transcriptRefusal("unavailable")).toBe(DocumentRefusalCode.TranscriptionUnavailable)
    })
})

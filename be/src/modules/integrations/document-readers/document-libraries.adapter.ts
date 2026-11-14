import { createRequire } from "node:module"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import { isLibraryMissing } from "./library-missing.policy"
import {
    type DocumentLibraries,
    type PdfDocument,
    type PictureTools,
    type RawImage,
} from "./document-readers.contracts"

/**
 * THE one file that loads the libraries behind the document readers. Every library loads on first use, so a process that never reads a
 * document never loads one. Two are optional and NOT installed today (see the install request of package BG1):
 * - `@napi-rs/canvas`: lets the PDF library paint a page that has neither a text layer nor an embedded picture (a vector-drawn scan);
 *   without it such a page is named in a warning.
 * - `heic-convert`: decodes an iPhone HEIC photo; without it a HEIC file is refused as `DOCUMENT_READER_UNAVAILABLE`.
 */

/** How large a page is painted, against its PDF size, when a painter is installed. */
const PAINT_SCALE = 2

/** The most pixels a picture may have before it is decoded (about 70 megapixels), so a crafted image cannot exhaust memory. */
const PIXEL_LIMIT = 70_000_000

/** The refusal for a library that is not installed, naming the package. */
const libraryMissing = (library: string, cause?: unknown): DocumentReadersError =>
    new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library }, cause })

/** Node's own module loader, for the optional libraries (both ship CommonJS). */
const loadModule = createRequire(__filename)

/**
 * A module by a name the compiler does not resolve, so a library that is not installed never breaks the build; a missing one is a
 * `DocumentReadersError` (LibraryMissing), any other failure of its loading is thrown as it is.
 */
const optional = (name: string): Promise<unknown> => {
    try {
        return Promise.resolve<unknown>(loadModule(name))
    } catch (cause) {
        const code: unknown = typeof cause === "object" && cause !== null ? Reflect.get(cause, "code") : undefined
        const missing = code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND"
        return Promise.reject(missing ? libraryMissing(name, cause) : cause)
    }
}

/** The callable default export of a module loaded by name. */
const callableOf = (module: unknown, name: string): ((...args: Array<unknown>) => unknown) => {
    const exported: unknown = typeof module === "function" ? module : Reflect.get(Object(module), "default")
    if (typeof exported !== "function") throw libraryMissing(name)
    return exported as (...args: Array<unknown>) => unknown
}

/** The picture tools over sharp. */
export const pictureToolsOf = (sharp: typeof import("sharp")): PictureTools => ({
    toJpeg(bytes: Uint8Array, side: number): Promise<Uint8Array> {
        return sharp(Buffer.from(bytes), { limitInputPixels: PIXEL_LIMIT, animated: false })
            .rotate()
            .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 85 })
            .toBuffer()
    },
    rawToJpeg(image: RawImage, side: number): Promise<Uint8Array> {
        const channels = image.channels === 1 || image.channels === 3 || image.channels === 4 ? image.channels : 3
        return sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels } })
            .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 85 })
            .toBuffer()
    },
})

/** A PDF opened with unpdf. */
const pdfOf = async (bytes: Uint8Array): Promise<PdfDocument> => {
    const unpdf = await import("unpdf")
    const proxy = await unpdf.getDocumentProxy(new Uint8Array(bytes))
    return {
        pageCount: proxy.numPages,
        async pageTexts(): Promise<ReadonlyArray<string>> {
            return (await unpdf.extractText(proxy, { mergePages: false })).text
        },
        pageImages(page: number): Promise<ReadonlyArray<RawImage>> {
            return unpdf.extractImages(proxy, page)
        },
        async renderPage(page: number): Promise<Uint8Array | null> {
            const canvas = await optional("@napi-rs/canvas").catch((cause: unknown) => {
                if (isLibraryMissing(cause)) return null
                throw cause
            })
            if (canvas === null) return null
            const painted = await unpdf.renderPageAsImage(proxy, page, {
                canvasImport: () => Promise.resolve(canvas as never),
                scale: PAINT_SCALE,
            })
            return new Uint8Array(painted)
        },
    }
}

/** The libraries of the readers, as the app loads them. */
export const documentLibraries: DocumentLibraries = {
    async wordToHtml(bytes: Uint8Array): Promise<string> {
        const mammoth = await import("mammoth")
        return (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value
    },
    openPdf: pdfOf,
    async pictures(): Promise<PictureTools> {
        const sharp = (await import("sharp")).default
        return pictureToolsOf(sharp)
    },
    async heicToJpeg(bytes: Uint8Array): Promise<Uint8Array> {
        const convert = callableOf(await optional("heic-convert"), "heic-convert")
        const out = await convert({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.9 })
        if (!(out instanceof ArrayBuffer) && !ArrayBuffer.isView(out)) throw new DocumentReadersError({ code: DocumentReadersErrorCode.ConversionEmpty, params: { library: "heic-convert" } })
        return out instanceof ArrayBuffer
            ? new Uint8Array(out)
            : new Uint8Array(out.buffer, out.byteOffset, out.byteLength)
    },
}

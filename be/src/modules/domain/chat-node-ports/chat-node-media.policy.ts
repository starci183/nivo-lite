import type { LineFile } from "@nivo-lite/blocks-core/rules/chatbot"
import { sepayQrUrlOf } from "@modules/domain/channels"
import type { ChannelSend } from "./chat-node-ports.policy"

/** The most pictures and files one stored line keeps. */
export const STORED_FILES_MAX = 10

/** The longest name a stored file keeps. */
const NAME_MAX = 500

/** The name a picture without a caption is kept under. */
const PICTURE_NAME = "image"

/** The media type of a picture by the end of its link; a link with no known ending is a JPEG (the shop's photos are). */
const typeOfLink = (url: string): string => {
    const path = url.split("?", 1).join("").toLowerCase()
    if (url.startsWith("https://qr.sepay.vn/") || path.endsWith(".png")) return "image/png"
    if (path.endsWith(".webp")) return "image/webp"
    if (path.endsWith(".gif")) return "image/gif"
    return "image/jpeg"
}

/** The name of a picture: the first line of its caption (the product name), else a plain word. */
const nameOf = (caption: string): string => {
    const first = caption.split("\n", 1).join("").trim()
    return (first === "" ? PICTURE_NAME : first).slice(0, NAME_MAX)
}

/** A file with the id it is kept under: its place in the line. */
const fileOf = (index: number, url: string, name: string, contentType: string): LineFile => ({
    id: `file-${String(index + 1)}`,
    url,
    name,
    contentType,
})

/**
 * The pictures and files a send puts in front of the customer, as the stored line keeps them, so the thread shows what was received: the
 * pictures of the send (the showcase album, the payment QR), then the files that are pictures, then the SePay QR image the words link to when no
 * picture carries it. A link already kept is kept once; at most {@link STORED_FILES_MAX}.
 */
export const storedFilesOf = (send: ChannelSend): ReadonlyArray<LineFile> => {
    const seen = new Set<string>()
    const files: Array<LineFile> = []
    const add = (url: string, name: string, contentType: string): void => {
        if (seen.has(url) || files.length >= STORED_FILES_MAX) return
        seen.add(url)
        files.push(fileOf(files.length, url, name, contentType))
    }
    for (const image of send.images ?? []) add(image.url, nameOf(image.caption), typeOfLink(image.url))
    for (const file of send.attachments ?? []) {
        if (file.contentType?.toLowerCase().startsWith("image/") === true) {
            add(file.url, file.name.slice(0, NAME_MAX), file.contentType)
        }
    }
    const qr = sepayQrUrlOf(send.text)
    if (qr !== null) add(qr, PICTURE_NAME, typeOfLink(qr))
    return files
}

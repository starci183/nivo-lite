import type { CaptionParts, ChannelImage, ImageRoute } from "./channel-image.contracts"

/** The most pictures one reply carries: one Telegram album holds ten. */
export const IMAGES_MAX = 10

/** The longest caption Telegram puts under a picture. */
export const TELEGRAM_CAPTION_MAX = 1024

/** The channels that show pictures, and no other: every other channel gets the pictures as links in the text. */
const PICTURE_CHANNELS: ReadonlySet<string> = new Set(["zalo", "telegram"])

/**
 * How the pictures of a reply go out on a channel. Zalo lays several into one collage image when a collage can be built, else sends them one
 * by one; Telegram sends several as one album with a caption on each; one picture is sent as itself. A channel that shows no pictures gets none
 * here (its replies carry them as links).
 */
export const imageRouteOf = (channel: string, count: number, collageReady: boolean): ImageRoute => {
    if (count <= 0 || !PICTURE_CHANNELS.has(channel)) return "none"
    if (count === 1) return "single"
    if (channel === "telegram") return "album"
    return collageReady ? "collage" : "each"
}

/** True when a channel shows the pictures of a reply as pictures. */
export const showsPictures = (channel: string): boolean => PICTURE_CHANNELS.has(channel)

/** The name and the price a caption holds: the first line is the name, the rest is the price. */
export const captionPartsOf = (caption: string): CaptionParts => {
    const lines = caption
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
    return { name: lines[0] ?? "", price: lines.slice(1).join(" ") }
}

/** The caption Telegram prints under a picture: the name, then the price on the next line, cut to what Telegram allows. */
export const telegramCaptionOf = (caption: string): string => {
    const { name, price } = captionPartsOf(caption)
    return [name, price]
        .filter((part) => part !== "")
        .join("\n")
        .slice(0, TELEGRAM_CAPTION_MAX)
}

/** The pictures as one line each for a channel that cannot show them: the words of the caption, then the address. */
export const imageLinksOf = (images: ReadonlyArray<ChannelImage>): ReadonlyArray<string> =>
    images.map((image) => {
        const { name, price } = captionPartsOf(image.caption)
        return `${[name, price].filter((part) => part !== "").join(" - ")}: ${image.url}`
    })

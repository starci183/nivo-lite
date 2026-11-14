/** One picture a message carries, with the words that go under it. */
export interface ChannelImage {
    /** The public address the channel fetches the picture from. */
    readonly url: string
    /** The words under the picture: the name on the first line, the price on the next. */
    readonly caption: string
}

/**
 * How the pictures of one reply reach the customer on one channel: not at all, one picture, several pictures as one album with a caption
 * on each (`album`), or several pictures one by one (`each`).
 */
export type ImageRoute = "none" | "single" | "album" | "each"

/** What a caption holds: the name and the price. */
export interface CaptionParts {
    /** The name, the first line. */
    readonly name: string
    /** The price, the rest of the lines. */
    readonly price: string
}

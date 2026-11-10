/** One picture a message carries, with the words that go under it. */
export interface ChannelImage {
    /** The public address the channel fetches the picture from. */
    readonly url: string
    /** The words under the picture: the name on the first line, the price on the next. */
    readonly caption: string
    /** What tells a changed picture from the same one, when the sender knows it; a collage is built again when it changes. */
    readonly version?: string | undefined
}

/**
 * How the pictures of one reply reach the customer on one channel: not at all, one picture, several pictures laid out as one image
 * (`collage`), several pictures as one album with a caption on each (`album`), or several pictures one by one (`each`).
 */
export type ImageRoute = "none" | "single" | "collage" | "album" | "each"

/** One cell of a collage: where its photo sits. */
export interface CollageTile {
    /** The left edge of the cell. */
    readonly x: number
    /** The top edge of the cell. */
    readonly y: number
    /** The width of the cell, which is also the side of its square photo. */
    readonly size: number
}

/** The grid of a collage: its size and the cell of every picture. */
export interface CollageLayout {
    /** How many columns. */
    readonly columns: number
    /** How many rows. */
    readonly rows: number
    /** The width of the image. */
    readonly width: number
    /** The height of the image. */
    readonly height: number
    /** The height of the words under a photo. */
    readonly labelHeight: number
    /** The size of the name text. */
    readonly nameSize: number
    /** The size of the price text. */
    readonly priceSize: number
    /** The cells, in the order of the pictures. */
    readonly tiles: ReadonlyArray<CollageTile>
}

/** The words under one photo of a collage: the name cut to lines and the price. */
export interface CollageLabel {
    /** The name, already cut to lines. */
    readonly nameLines: ReadonlyArray<string>
    /** The price text, or empty. */
    readonly price: string
}

/** The public address of a collage, a data address of a cropped photo, or null when there is none. */
export type OptionalCollageUrl = string | null

/** The JPEG bytes of a collage, or null when none could be drawn. */
export type OptionalCollageBytes = Buffer | null

/** What a caption holds: the name and the price. */
export interface CaptionParts {
    /** The name, the first line. */
    readonly name: string
    /** The price, the rest of the lines. */
    readonly price: string
}

/** A stored collage as the public address serves it. */
export interface StoredCollage {
    /** The bytes of the image. */
    readonly bytes: Buffer
    /** The content type of the image. */
    readonly contentType: string
}

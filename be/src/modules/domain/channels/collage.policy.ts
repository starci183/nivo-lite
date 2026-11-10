import { createHash } from "node:crypto"
import type { ChannelImage, CollageLabel, CollageLayout, CollageTile } from "./channel-image.contracts"
import { captionPartsOf } from "./channel-image.policy"

/** The most photos one collage holds; a seventh is left out. */
export const COLLAGE_MAX = 6

/** Bumped when the look of the collage changes, so a collage built the old way is never served for the new one. */
export const COLLAGE_STYLE = "v1"

/** The folder of the media bucket that holds collages: it sits under the public catalogue folder, and a collage is named by the hash of what it shows. */
export const COLLAGE_FOLDER = "catalogue-public/collages/"

/** The content type of a collage. */
export const COLLAGE_CONTENT_TYPE = "image/jpeg"

/** The brand colours: white tiles, a crimson price. */
const BRAND = {
    page: "#ffffff",
    card: "#ffffff",
    border: "#e4e4e7",
    empty: "#f4f4f5",
    name: "#18181b",
    price: "#e11d48",
}

const FONT = "Segoe UI, Roboto, Helvetica Neue, Arial, DejaVu Sans, sans-serif"
const WIDTH = 1080
const GAP = 24
const PAD = 10
const RADIUS = 28
const TEXT_PAD = 20
const NAME_LINES = 2
const KEY_PATTERN = /^[0-9a-f]{64}$/u

const clamp = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value))

/** How many columns a collage of `count` photos has: two side by side, then three across, four in a square. */
export const collageColumnsOf = (count: number): number => {
    if (count <= 1) return 1
    if (count === 2 || count === 4) return 2
    return 3
}

/**
 * The grid of a collage of `count` photos (at most six): a fixed width, square cells with a gap, the words under each photo. A last row
 * that is not full sits in the middle.
 */
export const collageLayoutOf = (count: number): CollageLayout => {
    const shown = clamp(Math.floor(count), 1, COLLAGE_MAX)
    const columns = collageColumnsOf(shown)
    const rows = Math.ceil(shown / columns)
    const size = Math.floor((WIDTH - GAP * (columns + 1)) / columns)
    const nameSize = clamp(Math.round(size * 0.07), 22, 34)
    const priceSize = nameSize + 4
    const labelHeight = Math.round(TEXT_PAD + nameSize * 1.3 * NAME_LINES + 8 + priceSize * 1.3 + TEXT_PAD)
    const cellHeight = size + labelHeight
    const tiles: Array<CollageTile> = []
    for (let index = 0; index < shown; index += 1) {
        const row = Math.floor(index / columns)
        const inRow = row === rows - 1 ? shown - row * columns : columns
        const indent = ((columns - inRow) * (size + GAP)) / 2
        tiles.push({
            x: Math.round(GAP + indent + (index % columns) * (size + GAP)),
            y: GAP + row * (cellHeight + GAP),
            size,
        })
    }
    return {
        columns,
        rows,
        width: WIDTH,
        height: GAP + rows * (cellHeight + GAP),
        labelHeight,
        nameSize,
        priceSize,
        tiles,
    }
}

/** The side of the square a photo is cropped to inside its cell. */
export const collagePhotoSizeOf = (tile: CollageTile): number => tile.size - PAD * 2

/** The words of a name cut into pieces that each fit `maxChars`: a word longer than a line is cut. */
const piecesOf = (text: string, maxChars: number): ReadonlyArray<string> =>
    text
        .split(/\s+/u)
        .filter((word) => word !== "")
        .flatMap((word) =>
            word.length > maxChars
                ? Array.from(word.matchAll(new RegExp(`.{1,${maxChars}}`, "gsu")), (cut) => cut[0])
                : [word],
        )

/** The name cut to lines of at most `maxChars` characters, at most `maxLines` of them; what does not fit ends the last line with an ellipsis. */
export const wrapLabel = (text: string, maxChars: number, maxLines: number): ReadonlyArray<string> => {
    const lines: Array<string> = []
    for (const piece of piecesOf(text, maxChars)) {
        const last = lines.length - 1
        if (last >= 0 && (lines[last]?.length ?? 0) + 1 + piece.length <= maxChars)
            lines[last] = `${lines[last]} ${piece}`
        else lines.push(piece)
    }
    if (lines.length <= maxLines) return lines
    const kept = lines.slice(0, maxLines)
    const end = kept[maxLines - 1] ?? ""
    kept[maxLines - 1] = `${end.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
    return kept
}

/** The words under every photo of a collage, cut to the width of its cells. */
export const collageLabelsOf = (
    images: ReadonlyArray<{ readonly caption: string }>,
    layout: CollageLayout,
): ReadonlyArray<CollageLabel> =>
    images.slice(0, layout.tiles.length).map((image, index) => {
        const size = layout.tiles[index]?.size ?? 0
        const maxChars = Math.max(6, Math.floor((size - TEXT_PAD * 2) / (layout.nameSize * 0.56)))
        const { name, price } = captionPartsOf(image.caption)
        return { nameLines: wrapLabel(name, maxChars, NAME_LINES), price }
    })

const escapeXml = (text: string): string =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/**
 * The collage as an SVG document: a white page, one rounded white tile per photo with its name in dark text and its price in crimson under
 * it. `photos` holds a data address per tile, or null where the photo could not be read (the tile keeps a grey square).
 */
export const collageSvgOf = (
    layout: CollageLayout,
    labels: ReadonlyArray<CollageLabel>,
    photos: ReadonlyArray<string | null>,
): string => {
    const tiles = layout.tiles.map((tile, index) => {
        const photo = photos[index] ?? null
        const label = labels[index] ?? { nameLines: [], price: "" }
        const inner = collagePhotoSizeOf(tile)
        const left = tile.x + PAD
        const top = tile.y + PAD
        const textX = tile.x + TEXT_PAD
        const nameTop = tile.y + tile.size + TEXT_PAD
        const names = label.nameLines
            .map(
                (line, lineIndex) =>
                    `<text x="${textX}" y="${Math.round(nameTop + layout.nameSize + lineIndex * layout.nameSize * 1.3)}" font-size="${layout.nameSize}" font-weight="600" fill="${BRAND.name}">${escapeXml(line)}</text>`,
            )
            .join("")
        const priceY = Math.round(
            nameTop + layout.nameSize * 1.3 * Math.max(1, label.nameLines.length) + 8 + layout.priceSize,
        )
        const price =
            label.price === ""
                ? ""
                : `<text x="${textX}" y="${priceY}" font-size="${layout.priceSize}" font-weight="700" fill="${BRAND.price}">${escapeXml(label.price)}</text>`
        const picture =
            photo === null
                ? `<rect x="${left}" y="${top}" width="${inner}" height="${inner}" rx="${RADIUS - PAD}" fill="${BRAND.empty}"/>`
                : `<clipPath id="clip${index}"><rect x="${left}" y="${top}" width="${inner}" height="${inner}" rx="${RADIUS - PAD}"/></clipPath><image x="${left}" y="${top}" width="${inner}" height="${inner}" href="${photo}" xlink:href="${photo}" clip-path="url(#clip${index})" preserveAspectRatio="xMidYMid slice"/>`
        return `<rect x="${tile.x}" y="${tile.y}" width="${tile.size}" height="${tile.size + layout.labelHeight}" rx="${RADIUS}" fill="${BRAND.card}" stroke="${BRAND.border}" stroke-width="2"/>${picture}${names}${price}`
    })
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family="${FONT}"><rect width="${layout.width}" height="${layout.height}" fill="${BRAND.page}"/>${tiles.join("")}</svg>`
}

/** What names a collage: the hash of the style and of the address, version and words of every photo it shows, in order, so the same set is built once. */
export const collageKeyOf = (
    images: ReadonlyArray<{ url: string; caption: string; version?: string | undefined }>,
): string =>
    createHash("sha256")
        .update(
            JSON.stringify([
                COLLAGE_STYLE,
                images.slice(0, COLLAGE_MAX).map((image) => [image.url, image.version ?? "", image.caption]),
            ]),
        )
        .digest("hex")

/** The photos a collage shows out of the pictures of a reply: the first six. */
export const collageImagesOf = (images: ReadonlyArray<ChannelImage>): ReadonlyArray<ChannelImage> =>
    images.slice(0, COLLAGE_MAX)

/** True when the text is the name of a collage. */
export const isCollageKey = (key: string): boolean => KEY_PATTERN.test(key)

/** Where a collage is kept in the media bucket. */
export const collagePathOf = (key: string): string => `${COLLAGE_FOLDER}${key}.jpg`

/** The public address of a collage, or null when the API has no public address. */
export const collageUrlOf = (publicApiUrl: string | undefined, key: string): string | null => {
    if (publicApiUrl === undefined || publicApiUrl === "") return null
    const base = publicApiUrl.endsWith("/") ? publicApiUrl.slice(0, -1) : publicApiUrl
    return `${base}/api/public/collages/${key}`
}

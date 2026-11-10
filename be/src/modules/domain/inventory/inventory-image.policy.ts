/** The folder of the media bucket that holds the photos of catalogue items: everything under it is public, nothing else is. */
export const PRODUCT_IMAGE_FOLDER = "catalogue-public/"

/** The content types an item photo may have, with the extension of the file each is kept under. */
export const PRODUCT_IMAGE_TYPES: ReadonlyMap<string, string> = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
])

/** The largest item photo, in bytes: a catalogue photo is a small picture, and Zalo fetches it for every customer. */
export const PRODUCT_IMAGE_MAX_BYTES = 1_500_000

/** The path of the photo of the item with `sku` in `workspaceId`, or null when the content type is none an item photo may have. */
export const productImagePathOf = (workspaceId: string, sku: string, contentType: string): string | null => {
    const extension = PRODUCT_IMAGE_TYPES.get(contentType)
    return extension === undefined ? null : `${PRODUCT_IMAGE_FOLDER}${workspaceId}/${sku.toLowerCase()}.${extension}`
}

/** True when the path is one of the public photos: only these are ever served without a session. */
export const isPublicProductImage = (path: string | null): path is string =>
    path !== null && path.startsWith(PRODUCT_IMAGE_FOLDER) && !path.includes("..")

/** The public address of the photo of one item, or null when the API has no public address (an empty text) or the item has no photo. */
export const productImageUrlOf = (publicApiUrl: string, itemId: string, path: string | null): string | null => {
    if (publicApiUrl === "" || !isPublicProductImage(path)) return null
    const base = publicApiUrl.endsWith("/") ? publicApiUrl.slice(0, -1) : publicApiUrl
    return `${base}/api/public/products/${itemId}/image`
}

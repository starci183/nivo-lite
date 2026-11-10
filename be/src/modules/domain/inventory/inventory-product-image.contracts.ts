/** The public photo of one catalogue item. */
export interface ProductImage {
    /** The bytes of the photo. */
    readonly bytes: Buffer
    /** The content type of the photo. */
    readonly contentType: string
}

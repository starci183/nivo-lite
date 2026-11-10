import type { ProductImage } from "@modules/domain/inventory"

/** What reading the photo of a product takes: the id of the product. */
export interface GetProductImageRequest {
    /** The id of the catalogue item. */
    readonly itemId: string
}

/** The photo of the product. */
export type GetProductImageResult = ProductImage

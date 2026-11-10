import { StreamableFile } from "@nestjs/common"
import type { StoredCollage } from "@modules/domain/channels"
import type { GetProductImageResult } from "../../application/get-product-image.contracts"

/** Maps the photo to the response body, typed and sized as the photo is. */
export const toProductImageFile = (image: GetProductImageResult): StreamableFile =>
    new StreamableFile(image.bytes, { type: image.contentType, length: image.bytes.length })

/** Maps the collage to the response body, typed and sized as the image is. */
export const toCollageFile = (collage: StoredCollage): StreamableFile =>
    new StreamableFile(collage.bytes, { type: collage.contentType, length: collage.bytes.length })

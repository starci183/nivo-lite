import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetProductImageRequest, GetProductImageResult } from "./get-product-image.contracts"

/** Reads the public photo of a product, for any caller. */
export class GetProductImageQuery extends Query<GetProductImageResult> {
    constructor(readonly params: PublicExecuteParams<GetProductImageRequest>) {
        super()
    }
}

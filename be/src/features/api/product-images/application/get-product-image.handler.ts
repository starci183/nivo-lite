import { QueryHandler } from "@nestjs/cqrs"
import { InventoryProductImageService } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetProductImageResult } from "./get-product-image.contracts"
import { GetProductImageQuery } from "./get-product-image.query"

@QueryHandler(GetProductImageQuery)
/** Runs get-product-image through one call of the InventoryProductImageService. */
export class GetProductImageHandler extends ICQRSHandler<GetProductImageQuery, GetProductImageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly images: InventoryProductImageService,
    ) {
        super(logger)
    }

    protected override process(query: GetProductImageQuery): Promise<GetProductImageResult> {
        return this.images.read(query.params.request.itemId)
    }
}

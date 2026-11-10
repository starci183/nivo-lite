import { Controller, Get, Header, Param, ParseUUIDPipe, StreamableFile } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { GetCollageQuery } from "../../application/get-collage.query"
import { GetProductImageQuery } from "../../application/get-product-image.query"
import { toCollageFile, toProductImageFile } from "./product-image.mapper"

@Controller("api/public")
/** The public addresses of product pictures: any caller may read the photo of a product on sale and a collage of such photos, nothing else of the store, and there is no listing. */
export class ProductImageController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Streams the photo of one product; a day of caching is fair, a photo changes only when the shop replaces it. */
    @Get("products/:id/image")
    @Public({ reason: PublicReason.CatalogRead })
    @Header("Cache-Control", "public, max-age=86400")
    @Header("X-Content-Type-Options", "nosniff")
    async image(@Param("id", new ParseUUIDPipe()) id: string): Promise<StreamableFile> {
        return toProductImageFile(await this.queryBus.execute(new GetProductImageQuery({ request: { itemId: id } })))
    }

    /** Streams a collage of product photos by the hash that names it; the hash is its content, so it never changes. */
    @Get("collages/:key")
    @Public({ reason: PublicReason.CatalogRead })
    @Header("Cache-Control", "public, max-age=86400")
    @Header("X-Content-Type-Options", "nosniff")
    async collage(@Param("key") key: string): Promise<StreamableFile> {
        return toCollageFile(await this.queryBus.execute(new GetCollageQuery({ request: { key } })))
    }
}

import { QueryHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import type { BrandMaterial } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetBrandMaterialQuery } from "./get-brand-material.query"

@QueryHandler(GetBrandMaterialQuery)
/** Reads public brand knowledge after enforcing workspace membership. */
export class GetBrandMaterialHandler extends ICQRSHandler<GetBrandMaterialQuery, BrandMaterial> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contentAi: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrandMaterialQuery): Promise<BrandMaterial> {
        return this.contentAi.brandFor(query.params.principal.id, query.params.request.workspaceId)
    }
}

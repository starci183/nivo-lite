import { Query } from "@nestjs/cqrs"
import type { BrandMaterial } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBrandMaterialRequest } from "./get-brand-material.contracts"

/** Requests the verified public knowledge used by content prompts. */
export class GetBrandMaterialQuery extends Query<BrandMaterial> {
    constructor(readonly params: ExecuteParams<GetBrandMaterialRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { OpenCatalog } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCatalogRequest } from "./get-catalog.contracts"

/** Asks for the whole catalogue of installable agents. */
export class GetCatalogQuery extends Query<OpenCatalog> {
    constructor(readonly params: ExecuteParams<GetCatalogRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { CatalogModule } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetModuleRequest } from "./get-module.contracts"

/** Asks for one module of the catalogue. */
export class GetModuleQuery extends Query<CatalogModule> {
    constructor(readonly params: ExecuteParams<GetModuleRequest>) {
        super()
    }
}

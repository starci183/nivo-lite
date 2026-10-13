import { Query } from "@nestjs/cqrs"
import type { ModuleDefinition } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetModuleRequest } from "./get-module.contracts"

/** Asks for one module of the catalogue. */
export class GetModuleQuery extends Query<ModuleDefinition> {
    constructor(readonly params: ExecuteParams<GetModuleRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { ContentWorkbench } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentWorkbenchRequest } from "./content-workbench.contracts"

/** The core content workbench data of the caller's workspace. */
export class GetContentWorkbenchQuery extends Query<ContentWorkbench> {
    constructor(readonly params: ExecuteParams<GetContentWorkbenchRequest>) {
        super()
    }
}

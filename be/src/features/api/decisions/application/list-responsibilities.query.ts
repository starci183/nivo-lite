import { Query } from "@nestjs/cqrs"
import type { ResponsibilityListing } from "@modules/domain/responsibilities"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListResponsibilitiesRequest } from "./list-responsibilities.contracts"

/** Asks for the responsibilities of the workspace with their customer. */
export class ListResponsibilitiesQuery extends Query<ReadonlyArray<ResponsibilityListing>> {
    constructor(readonly params: ExecuteParams<ListResponsibilitiesRequest>) {
        super()
    }
}

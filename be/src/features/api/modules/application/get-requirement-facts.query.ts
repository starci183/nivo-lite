import { Query } from "@nestjs/cqrs"
import type { RequirementFacts } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetRequirementFactsRequest } from "./get-requirement-facts.contracts"

/** Asks what the workspace has for the requirements of a module: connected providers and head counts. */
export class GetRequirementFactsQuery extends Query<RequirementFacts> {
    constructor(readonly params: ExecuteParams<GetRequirementFactsRequest>) {
        super()
    }
}

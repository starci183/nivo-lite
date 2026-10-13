import { Query } from "@nestjs/cqrs"
import type { CandidateView } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListCommandCandidatesRequest } from "./list-command-candidates.contracts"

/** Asks for the latest command cards of the workspace. */
export class ListCommandCandidatesQuery extends Query<ReadonlyArray<CandidateView>> {
    constructor(readonly params: ExecuteParams<ListCommandCandidatesRequest>) {
        super()
    }
}

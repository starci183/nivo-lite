import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkspaceRef, LoyaltyProgramSettings } from "./get-loyalty-program.contracts"

/** Requests get loyalty program for the current principal. */
export class GetLoyaltyProgramQuery extends Query<LoyaltyProgramSettings> {
    constructor(readonly params: ExecuteParams<WorkspaceRef>) {
        super()
    }
}

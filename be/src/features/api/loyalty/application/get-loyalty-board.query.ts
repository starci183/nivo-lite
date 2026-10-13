import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkspaceRef, LoyaltyBoard } from "./get-loyalty-board.contracts"

/** Requests get loyalty board for the current principal. */
export class GetLoyaltyBoardQuery extends Query<LoyaltyBoard> {
    constructor(readonly params: ExecuteParams<WorkspaceRef>) {
        super()
    }
}

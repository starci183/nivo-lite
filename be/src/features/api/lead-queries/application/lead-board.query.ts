import { Query } from "@nestjs/cqrs"
import type { LeadBoardItem } from "@modules/domain/lead-views"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { Connection } from "@modules/platform/pagination"
import type { LeadBoardRequest } from "./lead-board.contracts"

/** Asks for the workspace's lead board. */
export class LeadBoardQuery extends Query<Connection<LeadBoardItem>> {
    constructor(readonly params: ExecuteParams<LeadBoardRequest>) {
        super()
    }
}

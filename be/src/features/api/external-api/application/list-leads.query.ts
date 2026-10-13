import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ListLeadsRequest, ListLeadsResult } from "./list-leads.contracts"

/** Asks for the customers of the workspace the API key acts for. */
export class ListLeadsQuery extends Query<ListLeadsResult> {
    constructor(readonly params: PublicExecuteParams<ListLeadsRequest>) {
        super()
    }
}

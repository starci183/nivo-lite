import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConnectionAccountDataStats, GetConnectionAccountDataRequest } from "./get-connection-account-data.contracts"

/** Asks what an account keeps of its provider data: per declared type, its rows and its newest one. */
export class GetConnectionAccountDataQuery extends Query<ConnectionAccountDataStats> {
    constructor(readonly params: ExecuteParams<GetConnectionAccountDataRequest>) {
        super()
    }
}

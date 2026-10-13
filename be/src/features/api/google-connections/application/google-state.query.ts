import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GoogleStateRequest, GoogleStateResult } from "./google-state.contracts"

/** Says whether Google is set up on this deployment. */
export class GoogleStateQuery extends Query<GoogleStateResult> {
    constructor(readonly params: ExecuteParams<GoogleStateRequest>) {
        super()
    }
}

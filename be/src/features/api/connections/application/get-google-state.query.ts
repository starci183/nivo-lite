import { Query } from "@nestjs/cqrs"
import type { GoogleStateResult, GetGoogleStateRequest } from "./get-google-state.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks whether Google can be used on this deployment. */
export class GetGoogleStateQuery extends Query<GoogleStateResult> {
    constructor(readonly params: ExecuteParams<GetGoogleStateRequest>) {
        super()
    }
}

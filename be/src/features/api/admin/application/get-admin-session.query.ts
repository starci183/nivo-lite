import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAdminSessionRequest, GetAdminSessionResult } from "./get-admin-session.contracts"

/** Answers who the signed-in platform admin is; anyone else gets a not-found. */
export class GetAdminSessionQuery extends Query<GetAdminSessionResult> {
    constructor(readonly params: ExecuteParams<GetAdminSessionRequest>) {
        super()
    }
}

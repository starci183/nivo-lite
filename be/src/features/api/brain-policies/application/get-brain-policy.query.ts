import { Query } from "@nestjs/cqrs"
import type { BrainPolicyDetailWire } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** What the BrainPolicy read (one row's drawer) takes. */
export interface GetBrainPolicyRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership and role. */
    readonly workspaceId: string
    /** The row (`factId` of a row). */
    readonly factId: string
}

/** Reads the drawer of one policy row. */
export class GetBrainPolicyQuery extends Query<BrainPolicyDetailWire | null> {
    constructor(readonly params: ExecuteParams<GetBrainPolicyRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { BrainPoliciesWire } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** What the BrainPolicies read takes. */
export interface GetBrainPoliciesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership and role. */
    readonly workspaceId: string
}

/** Reads the Policies tab. */
export class GetBrainPoliciesQuery extends Query<BrainPoliciesWire> {
    constructor(readonly params: ExecuteParams<GetBrainPoliciesRequest>) {
        super()
    }
}

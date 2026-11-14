import { Command } from "@nestjs/cqrs"
import type { PolicyDeriveRequested } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** What the derive door takes. */
export interface DeriveBrainPoliciesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership and role. */
    readonly workspaceId: string
}

/** Asks for a derive pass of the workspace's policies (the backfill of a workspace, or a retry after a failed pass). */
export class DeriveBrainPoliciesCommand extends Command<PolicyDeriveRequested> {
    constructor(readonly params: ExecuteParams<DeriveBrainPoliciesRequest>) {
        super()
    }
}

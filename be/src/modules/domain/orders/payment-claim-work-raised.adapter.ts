import { Injectable } from "@nestjs/common"
import type { WorkRaisedHook } from "@modules/domain/work-items"
import { PaymentClaimGraphAdapter } from "./payment-claim-graph.adapter"

@Injectable()
/**
 * What the work engine tells the capability that owns payment claims when a graph node raised a work item for a claim: the claim is
 * handed to the owner (escalated) once, by that item. Bound to the engine's raised hook from the orders side, so the engine names no claim.
 */
export class PaymentClaimWorkRaisedAdapter implements WorkRaisedHook {
    constructor(private readonly claims: PaymentClaimGraphAdapter) {}

    /** Escalates the claim; a claim already settled or escalated stays as it is. */
    async raised(workspaceId: string, claimId: string, _workItemId: string): Promise<void> {
        await this.claims.escalate(workspaceId, claimId)
    }
}

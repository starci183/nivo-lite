import type { RequestStanding } from "@modules/domain/approval-requests"
import type { ApprovalState } from "./team-chat.contracts"

/**
 * Where one decision stands as its card shows it: a rejected request reads as refused, the settler is named by the seat that settled
 * it, and the viewer may decide only a pending request that asked their seat.
 */
export const approvalStateOf = (
    standing: RequestStanding,
    viewerSeatId: string | null,
    settlerNames: ReadonlyMap<string, string>,
): ApprovalState => ({
    decisionId: standing.id,
    status: standing.status === "rejected" ? "refused" : standing.status,
    decidedByName: standing.resolvedBy === null ? null : (settlerNames.get(standing.resolvedBy) ?? null),
    decidedAt: standing.resolvedAt,
    canDecide: standing.status === "pending" && viewerSeatId !== null && standing.askedSeatIds.includes(viewerSeatId),
})

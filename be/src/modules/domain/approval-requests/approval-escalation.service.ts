import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ApproverRef, DirectoryMember } from "@modules/domain/member-grants"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalResolved } from "./approval-requests.contracts"
import { InjectApprovalAgentOwners } from "./approval-requests.decorators"
import type { AgentOwnerRef, ApprovalAgentOwners } from "./approval-requests.port"
import type { OwnerSeatRow, ApprovalRequestRow } from "./persistence/approval-requests.rows"
import { FIND_OWNER_SEAT, RESOLVE_REQUEST } from "./persistence/approval-requests.sql"

const NOBODY: AgentOwnerRef = { ownerMemberId: null, fallbackMemberId: null }

const refOf = (member: DirectoryMember): ApproverRef => ({
    memberId: member.memberId,
    name: member.name,
    role: member.role,
    roomId: member.roomId,
})

@Injectable()
/** Hands a request that ran out of time to the owner of the agent that asked, and settles it as expired. */
export class ApprovalEscalationService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectApprovalAgentOwners() private readonly agentOwners: ApprovalAgentOwners,
    ) {}

    /**
     * Settles a pending request as expired inside the caller's transaction, naming who it went to: the owner of the agent that
     * asked, else their fallback, else the workspace owner, each only while their seat is active; nobody when none is. Answers the
     * event to publish once the transaction commits.
     */
    async expire(
        tx: EntityManager,
        row: ApprovalRequestRow,
        directory: ReadonlyArray<DirectoryMember>,
        now: Date,
    ): Promise<ApprovalResolved> {
        const target = await this.targetOf(tx, row, directory)
        await tx.query(RESOLVE_REQUEST, [row.id, "expired", null, now.toISOString(), target?.memberId ?? null])
        return {
            requestId: row.id,
            outcome: "expired",
            decidedBy: null,
            decidedByName: null,
            action: row.action,
            workspaceId: row.workspace_id,
            chainStepId: row.chain_step_id,
            escalatedTo: target,
        }
    }

    private async targetOf(
        tx: EntityManager,
        row: ApprovalRequestRow,
        directory: ReadonlyArray<DirectoryMember>,
    ): Promise<ApproverRef | null> {
        const owners = await this.ownersOf(row)
        const [seat] = await tx.query<Array<OwnerSeatRow>>(FIND_OWNER_SEAT, [row.workspace_id])
        const candidates = [owners.ownerMemberId, owners.fallbackMemberId, seat?.id ?? null]
        const active = candidates.flatMap((id) =>
            directory.filter((member) => member.memberId === id && member.status === "active"),
        )
        const [first] = active
        return first === undefined ? null : refOf(first)
    }

    private async ownersOf(row: ApprovalRequestRow): Promise<AgentOwnerRef> {
        if (row.requested_by_agent_id === null) return NOBODY
        try {
            return await this.agentOwners.ownerOf(row.requested_by_agent_id)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.OwnerUnreadable, cause, { requestId: row.id })
            return NOBODY
        }
    }
}

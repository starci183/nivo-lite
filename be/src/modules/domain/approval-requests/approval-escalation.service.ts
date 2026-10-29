import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ApproverRef, DirectoryMember } from "@modules/domain/member-grants"
import { callDbFunction } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import type { ApprovalRequestRecord, ApprovalResolved } from "./approval-requests.contracts"
import { InjectApprovalAgentOwners } from "./approval-requests.decorators"
import type { AgentOwnerRef, ApprovalAgentOwners } from "./approval-requests.port"
import { ApprovalRequestEntity } from "./persistence/entities"

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
        row: ApprovalRequestRecord,
        directory: ReadonlyArray<DirectoryMember>,
        now: Date,
    ): Promise<ApprovalResolved> {
        const target = await this.targetOf(tx, row, directory)
        await tx.update(
            ApprovalRequestEntity,
            { id: row.id, status: "pending" },
            { status: "expired", resolvedBy: null, resolvedAt: now, escalatedTo: target?.memberId ?? null },
        )
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
        row: ApprovalRequestRecord,
        directory: ReadonlyArray<DirectoryMember>,
    ): Promise<ApproverRef | null> {
        const owners = await this.ownersOf(row)
        const [seat] = await callDbFunction<{ workspace_owner_member: string | null }>(
            tx,
            "public.workspace_owner_member",
            [row.workspace_id],
        )
        const candidates = [owners.ownerMemberId, owners.fallbackMemberId, seat?.workspace_owner_member ?? null]
        const active = candidates.flatMap((id) =>
            directory.filter((member) => member.memberId === id && member.status === "active"),
        )
        const [first] = active
        return first === undefined ? null : refOf(first)
    }

    private async ownersOf(row: ApprovalRequestRecord): Promise<AgentOwnerRef> {
        if (row.requested_by_agent_id === null) return NOBODY
        try {
            return await this.agentOwners.ownerOf(row.requested_by_agent_id)
        } catch (cause) {
            this.logger.error(ApprovalLogEvent.OwnerUnreadable, cause, { requestId: row.id })
            return NOBODY
        }
    }
}

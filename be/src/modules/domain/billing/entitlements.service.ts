import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { BillingService } from "./billing.service"
import type { Plan, WorkspaceStorage } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const BYTES_PER_GB = 1024 ** 3

@Injectable()
/** What the plan of a workspace allows: other members (none on an individual plan, paid seats on Team) and stored bytes. */
export class EntitlementsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly billing: BillingService,
        private readonly memberReads: WorkspaceMembersReadService,
    ) {}

    /**
     * Refuses an invitation the plan cannot take: individual plans take nobody, per-seat plans take as many people as paid seats,
     * counting the members and the invitations still pending (`pendingInvites`, counted by workspace-invites, which owns them).
     */
    async requireRoomForInvite(workspaceId: string, pendingInvites: number): Promise<void> {
        const plan = await this.planOf(workspaceId)
        if (plan === null) return
        if (plan.individual) throw new BillingError({ code: BillingErrorCode.PlanIndividualOnly })
        const seats = await this.paidSeats(workspaceId, plan)
        if (seats === null) return
        const members = await this.members(workspaceId)
        if (members + pendingInvites >= seats) throw new BillingError({ code: BillingErrorCode.SeatLimitReached })
    }

    /** Refuses accepting an invitation into a workspace whose plan cannot take another member. */
    async requireRoomForMember(workspaceId: string): Promise<void> {
        const plan = await this.planOf(workspaceId)
        if (plan === null) return
        if (plan.individual) throw new BillingError({ code: BillingErrorCode.PlanIndividualOnly })
        const seats = await this.paidSeats(workspaceId, plan)
        if (seats === null) return
        if ((await this.members(workspaceId)) >= seats) {
            throw new BillingError({ code: BillingErrorCode.SeatLimitReached })
        }
    }

    /** Refuses an upload when the stored bytes plus the incoming ones (when known) pass what the plan includes; the caller proved the role. */
    async requireStorageFor(workspaceId: string, incomingBytes: number): Promise<void> {
        const storage = await this.storage(workspaceId)
        if (storage.quotaBytes === null) return
        if (storage.usedBytes + Math.max(0, incomingBytes) > storage.quotaBytes) {
            throw new BillingError({
                code: BillingErrorCode.StorageQuotaExceeded,
                params: { quotaGb: Math.round(storage.quotaBytes / BYTES_PER_GB) },
            })
        }
    }

    /** The storage a workspace keeps and the room its plan includes, for one of its members. */
    async storageOf(userId: string, workspaceId: string): Promise<WorkspaceStorage> {
        await this.billing.requireMember(userId, workspaceId)
        return this.storage(workspaceId)
    }

    private async storage(workspaceId: string): Promise<WorkspaceStorage> {
        const plan = await this.planOf(workspaceId)
        const [row] = await callDbFunction<{ readonly workspace_storage_bytes: string | null }>(
            this.entityManager,
            "public.workspace_storage_bytes",
            [workspaceId],
        )
        return {
            usedBytes: Number(row?.workspace_storage_bytes ?? 0),
            quotaBytes: plan?.storageGb == null ? null : plan.storageGb * BYTES_PER_GB,
        }
    }

    /** The plan of a workspace, or null when it has none (a workspace that has not paid yet is not limited). */
    private async planOf(workspaceId: string): Promise<Plan | null> {
        const workspace = await this.billing.findWorkspaceBilling(workspaceId)
        return workspace?.planCode == null ? null : this.billing.findPlan(workspace.planCode)
    }

    /** The paid seats of a per-seat plan; null when the plan is not per seat or the workspace does not track seats. */
    private async paidSeats(workspaceId: string, plan: Plan): Promise<number | null> {
        if (!plan.perSeat) return null
        const workspace = await this.billing.findWorkspaceBilling(workspaceId)
        return workspace?.seatCount ?? null
    }

    private members(workspaceId: string): Promise<number> {
        return this.memberReads.activeCount(workspaceId)
    }
}
